import type { ToolOutput } from '../../shared/types'

export interface TraceEntry {
  id: string
  name: string
  input: unknown
  output?: ToolOutput
}

export function ToolTrace({ entry }: { entry: TraceEntry }) {
  const status = entry.output ? (entry.output.isError ? '✗' : '✓') : '…'
  return (
    <details class="trace">
      <summary>
        🔧 {entry.name} {status}
      </summary>
      <pre class="trace-input">{JSON.stringify(entry.input, null, 2)}</pre>
      {entry.output && <pre class="trace-output">{entry.output.text.slice(0, 2000)}</pre>}
    </details>
  )
}
