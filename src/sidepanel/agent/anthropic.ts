import type { ContentBlock, Settings, ToolParam, WireMessage } from '../../shared/types'
import { createSseParser } from '../../shared/sse'

// 规范化 Anthropic 兼容端点：剥首尾空白、尾部斜杠与误加的 /v1、/v1/messages
// （Anthropic 协议约定 baseUrl 为协议根，如 https://open.bigmodel.cn/api/anthropic）
export function normalizeBaseUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '')
  if (u.endsWith('/v1/messages')) u = u.slice(0, -'/v1/messages'.length)
  else if (u.endsWith('/v1')) u = u.slice(0, -'/v1'.length)
  return u.replace(/\/+$/, '')
}

export class ApiError extends Error {
  constructor(
    public status: number,
    body: string,
    public url?: string,
  ) {
    super(formatApiError(status, body, url))
  }
}

function formatApiError(status: number, body: string, url?: string): string {
  const where = url ? `（请求地址 ${url}）` : ''
  // 网关返回 HTML 错误页（如 nginx 405）说明路径不对，原文没有诊断价值
  if (/<html/i.test(body)) {
    return `API ${status}${where}：端点返回了网页而非 API 响应，baseUrl 大概率填错。请填 Anthropic 兼容端点的协议根（不带 /v1；GLM 示例：https://open.bigmodel.cn/api/anthropic）`
  }
  return `Anthropic API ${status}${where}: ${body.slice(0, 300)}`
}

// 把 SSE 事件流组装为完整的 assistant 消息；onTextDelta 用于 UI 流式渲染
export function createMessageAssembler(onTextDelta?: (t: string) => void) {
  const blocks: ContentBlock[] = []
  let curText = ''
  let curTool: { id: string; name: string; json: string } | null = null
  let stopReason = 'end_turn'

  function flush(): void {
    if (curText) {
      blocks.push({ type: 'text', text: curText })
      curText = ''
    }
    if (curTool) {
      let input: unknown
      try {
        input = JSON.parse(curTool.json || '{}')
      } catch {
        input = {}
      }
      blocks.push({ type: 'tool_use', id: curTool.id, name: curTool.name, input })
      curTool = null
    }
  }

  return {
    push(ev: Record<string, any>): void {
      switch (ev.type) {
        case 'content_block_start':
          if (ev.content_block?.type === 'tool_use')
            curTool = { id: ev.content_block.id, name: ev.content_block.name, json: '' }
          break
        case 'content_block_delta':
          if (ev.delta?.type === 'text_delta') {
            curText += ev.delta.text as string
            onTextDelta?.(ev.delta.text as string)
          } else if (ev.delta?.type === 'input_json_delta' && curTool) {
            curTool.json += ev.delta.partial_json as string
          }
          break
        case 'content_block_stop':
          flush()
          break
        case 'message_delta':
          if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason
          break
      }
    },
    result(): { message: WireMessage; stopReason: string } {
      flush()
      return { message: { role: 'assistant', content: blocks }, stopReason }
    },
  }
}

export interface StreamOptions {
  settings: Settings
  system: string
  messages: WireMessage[]
  tools?: ToolParam[]
  signal?: AbortSignal
  onTextDelta?: (t: string) => void
}

// 拉取端点的可用模型列表（GET /v1/models，Anthropic 协议）
export async function listModels(settings: Settings): Promise<string[]> {
  const base = normalizeBaseUrl(settings.baseUrl)
  const url = `${base}/v1/models?limit=100`
  const res = await fetch(url, {
    headers: { 'x-api-key': settings.apiKey, 'anthropic-version': '2023-06-01' },
  })
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''), url)
  const json = (await res.json()) as { data?: Array<{ id?: string }> }
  const ids = (json.data ?? []).map((m) => String(m.id ?? '')).filter(Boolean)
  return [...new Set(ids)].sort()
}

export async function streamMessage(opts: StreamOptions): Promise<{ message: WireMessage; stopReason: string }> {
  const base = normalizeBaseUrl(opts.settings.baseUrl)
  const url = `${base}/v1/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.settings.model,
      max_tokens: 8192,
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools,
      stream: true,
    }),
    signal: opts.signal,
  })
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''), url)
  if (!res.body) throw new Error('Anthropic 响应无 body')

  const assembler = createMessageAssembler(opts.onTextDelta)
  const feed = createSseParser((data) => {
    if (data === '[DONE]') return
    try {
      assembler.push(JSON.parse(data))
    } catch {
      // 忽略无法解析的行
    }
  })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    feed(decoder.decode(value, { stream: true }))
  }
  return assembler.result()
}
