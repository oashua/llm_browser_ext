import { useEffect, useRef } from 'preact/hooks'
import type { ToolResultBlock, WireMessage } from '../../shared/types'
import { IconSend, IconStop, IconTrash } from './icons'
import { renderMarkdown } from './Markdown'
import { ToolTrace, type TraceEntry } from './ToolTrace'
import { traceOutputFromResult } from './traceOutput'

export interface ChatProps {
  messages: WireMessage[]
  streamingText: string
  running: boolean
  error: string
  onSend: (text: string) => void
  onStop: () => void
  onRetry: () => void
  onClear: () => void
}

export function Chat(props: ChatProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [props.messages.length, props.streamingText])

  // 从消息序列构造视图项：文本气泡 + 工具轨迹
  const toolResults = new Map<string, ToolResultBlock>()
  for (const m of props.messages)
    for (const b of m.content)
      if (b.type === 'tool_result') toolResults.set(b.tool_use_id, b)

  const items: Array<{ kind: 'user' | 'assistant' | 'trace'; text?: string; entry?: TraceEntry }> = []
  for (const m of props.messages) {
    for (const b of m.content) {
      if (b.type === 'text' && b.text.trim())
        items.push({ kind: m.role === 'user' ? 'user' : 'assistant', text: b.text })
      else if (b.type === 'tool_use') {
        const result = toolResults.get(b.id)
        const entry: TraceEntry = {
          id: b.id,
          name: b.name,
          input: b.input,
          output: result ? traceOutputFromResult(result) : undefined,
        }
        items.push({ kind: 'trace', entry })
      }
    }
  }

  function send(): void {
    const text = inputRef.current?.value.trim()
    if (!text || props.running) return
    if (inputRef.current) inputRef.current.value = ''
    props.onSend(text)
  }

  return (
    <div class="chat">
      <div class="msg-list" ref={listRef}>
        {items.length === 0 && !props.streamingText && <div class="empty">向 AI 提问当前网页内容…</div>}
        {items.map((it, i) =>
          it.kind === 'trace' ? (
            <ToolTrace key={`t${i}`} entry={it.entry!} />
          ) : (
            <div key={i} class={`bubble ${it.kind}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(it.text!) }} />
          ),
        )}
        {props.streamingText && (
          <div class="bubble assistant" dangerouslySetInnerHTML={{ __html: renderMarkdown(props.streamingText) }} />
        )}
        {props.error && (
          <div class="error-card">
            <div>{props.error}</div>
            <button onClick={() => props.onRetry()}>重试</button>
          </div>
        )}
      </div>
      <div class="input-row">
        <textarea
          ref={inputRef}
          placeholder="询问当前网页…（Enter 发送，Shift+Enter 换行）"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        {props.running ? (
          <button class="icon-btn stop" title="停止" onClick={() => props.onStop()}>
            <IconStop />
          </button>
        ) : (
          <button class="icon-btn send" title="发送" onClick={() => send()}>
            <IconSend />
          </button>
        )}
        <button class="icon-btn ghost" title="清空会话" onClick={() => props.onClear()}>
          <IconTrash />
        </button>
      </div>
    </div>
  )
}
