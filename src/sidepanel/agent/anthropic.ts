import type { ContentBlock, Settings, ToolParam, WireMessage } from '../../shared/types'
import { createSseParser } from '../../shared/sse'

export class ApiError extends Error {
  constructor(
    public status: number,
    body: string,
  ) {
    super(`Anthropic API ${status}: ${body.slice(0, 300)}`)
  }
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

export async function streamMessage(opts: StreamOptions): Promise<{ message: WireMessage; stopReason: string }> {
  const base = opts.settings.baseUrl.replace(/\/+$/, '')
  const res = await fetch(`${base}/v1/messages`, {
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
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''))
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
