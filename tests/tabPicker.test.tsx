// @vitest-environment happy-dom
import { render } from 'preact'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TabPicker, type PickerTab } from '../src/sidepanel/components/TabPicker'

const TABS: PickerTab[] = [
  { id: 1, title: '页面 A', url: 'https://a.dev' },
  { id: 2, title: '页面 B', url: 'https://b.dev' },
]

let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
})
afterEach(() => container.remove())

async function flushEffects(): Promise<void> {
  // preact useEffect 调度在 happy-dom 下用宏任务等待最稳
  for (let i = 0; i < 5; i++) await new Promise<void>((r) => setTimeout(r, 0))
}

async function mount(): Promise<HTMLDetailsElement> {
  render(<TabPicker tabs={TABS} selected={[1]} onToggle={() => {}} />, container)
  await flushEffects()
  const el = container.querySelector('details.tab-picker') as HTMLDetailsElement
  expect(el).toBeTruthy()
  return el
}

describe('TabPicker 下拉收起', () => {
  it('面板打开时，点击面板外部应收起', async () => {
    const el = await mount()
    el.open = true
    document.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    expect(el.open).toBe(false)
  })

  it('点击面板内部（如标签行）不应收起，便于连续勾选', async () => {
    const el = await mount()
    el.open = true
    const label = el.querySelector('.tab-list label') as HTMLElement
    label.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    expect(el.open).toBe(true)
  })
})
