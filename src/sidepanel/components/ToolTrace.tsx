import type { ToolOutput } from '../../shared/types'
import { IconChevron } from './icons'

export interface TraceEntry {
  id: string
  name: string
  input: unknown
  output?: ToolOutput
}

export function ToolTrace({ entry }: { entry: TraceEntry }) {
  const status = entry.output ? (entry.output.isError ? '失败' : '完成') : '运行中'
  return (
    <details class="trace">
      <summary>
        <span class="trace-chevron">
          <IconChevron />
        </span>
        <span class="trace-name">{entry.name}</span>
        <span class={`trace-status ${entry.output ? (entry.output.isError ? 'error' : 'ok') : 'running'}`}>{status}</span>
      </summary>
      <div class="trace-body">
        <pre class="trace-input">{JSON.stringify(entry.input, null, 2)}</pre>
        {entry.output && <pre class="trace-output">{entry.output.text.slice(0, 2000)}</pre>}
      </div>
    </details>
  )
}
