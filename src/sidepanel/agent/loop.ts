import type {
  ContentBlock, Settings, TextBlock, ToolContext, ToolDef, ToolParam, ToolUseBlock, ToolOutput, WireMessage,
} from '../../shared/types'
import { streamMessage } from './anthropic'
import { dispatchTool } from './tools/registry'

export const MAX_TOOL_HOPS = 20

export interface LoopCallbacks {
  textDelta?: (t: string) => void
  assistant?: (m: WireMessage) => void
  toolCall?: (name: string, input: unknown) => void
  toolResult?: (name: string, output: ToolOutput) => void
}

export interface LoopDeps {
  settings: Settings
  system: string
  history: WireMessage[]
  tools: ToolDef[]
  ctx: ToolContext
  signal?: AbortSignal
  streamFn?: typeof streamMessage
  on?: LoopCallbacks
  /** 每 hop 重新解析 settings/system/tools（update_settings 修改后立即生效，无需等下一轮） */
  resolve?: () => { settings: Settings; system: string; tools: ToolDef[] }
}

// 主循环：流式请求 → 若有 tool_use 则执行并回传 → 重复直到 end_turn 或达上限
export async function runAgentLoop(deps: LoopDeps): Promise<WireMessage[]> {
  const streamFn = deps.streamFn ?? streamMessage
  const on = deps.on ?? {}
  const messages = [...deps.history]
  for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
    const r = deps.resolve?.() ?? { settings: deps.settings, system: deps.system, tools: deps.tools }
    const toolParams: ToolParam[] = r.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }))
    const { message, stopReason } = await streamFn({
      settings: r.settings,
      system: r.system,
      messages,
      tools: toolParams.length ? toolParams : undefined,
      signal: deps.signal,
      onTextDelta: on.textDelta,
    })
    messages.push(message)
    on.assistant?.(message)
    const calls = message.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
    if (stopReason !== 'tool_use' || calls.length === 0) break
    const results: ContentBlock[] = []
    for (const call of calls) {
      on.toolCall?.(call.name, call.input)
      let output: ToolOutput
      try {
        output = await dispatchTool(call.name, (call.input ?? {}) as Record<string, unknown>, { ...deps.ctx, settings: r.settings }, r.tools)
      } catch (e) {
        output = { text: e instanceof Error ? e.message : String(e), isError: true }
      }
      on.toolResult?.(call.name, output)
      const content = output.images?.length
        ? ([{ type: 'text', text: output.text } as TextBlock, ...output.images])
        : output.text
      results.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content,
        is_error: output.isError ? true : undefined,
      })
    }
    messages.push({ role: 'user', content: results })
  }
  return messages
}
