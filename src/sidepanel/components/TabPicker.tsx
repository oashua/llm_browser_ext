import { IconLayers } from './icons'

export interface PickerTab {
  id: number
  title: string
  url: string
}

export interface TabPickerProps {
  tabs: PickerTab[]
  selected: number[]
  onToggle: (id: number) => void
}

export function TabPicker(props: TabPickerProps) {
  const byId = new Map(props.tabs.map((t) => [t.id, t]))
  const chips = props.selected.filter((id) => byId.has(id))
  return (
    <details class="tab-picker">
      <summary>
        <span class="picker-label">
          <IconLayers />
          <span>上下文</span>
          <span class="count">{chips.length}</span>
        </span>
        {chips.map((id) => (
          <span class="chip" title={byId.get(id)!.url}>
            {byId.get(id)!.title.slice(0, 12)}
          </span>
        ))}
      </summary>
      <div class="tab-list">
        {props.tabs.map((t) => (
          <label key={t.id}>
            <input
              type="checkbox"
              checked={props.selected.includes(t.id)}
              onChange={() => props.onToggle(t.id)}
            />
            <span class="tab-title" title={t.url}>
              {t.title || t.url}
            </span>
          </label>
        ))}
      </div>
    </details>
  )
}
