// @vitest-environment happy-dom
import { render } from 'preact'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Chat } from '../src/sidepanel/components/Chat'
import type { WireMessage } from '../src/shared/types'

const MESSAGES: WireMessage[] = [
  { role: 'user', content: [{ type: 'text', text: '这页讲了什么？' }] },
  { role: 'assistant', content: [{ type: 'text', text: '长回答 '.repeat(200) }] },
]

const PROPS = {
  messages: MESSAGES,
  streamingText: '',
  running: false,
  error: '',
  onSend: () => {},
  onStop: () => {},
  onRetry: () => {},
  onClear: () => {},
}

let container: HTMLDivElement

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
})
afterEach(() => container.remove())

async function setupList(): Promise<{ el: HTMLDivElement; scrollTo: ReturnType<typeof vi.fn> }> {
  render(<Chat {...PROPS} />, container)
  const el = container.querySelector('.msg-list') as HTMLDivElement
  expect(el).toBeTruthy()
  // happy-dom 无布局：覆写尺寸属性并捕获滚动调用
  const scrollTo = vi.fn()
  Object.defineProperty(el, 'scrollHeight', { value: 2000, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true })
  el.scrollTo = scrollTo as unknown as typeof el.scrollTo
  return { el, scrollTo }
}

async function flushEffects(): Promise<void> {
  // preact useEffect 调度在 happy-dom 下用宏任务等待最稳
  for (let i = 0; i < 5; i++) await new Promise<void>((r) => setTimeout(r, 0))
}

describe('Chat 自动滚动（stick-to-bottom）', () => {
  it('用户位于底部附近时，流式更新仍自动滚到底', async () => {
    const { el, scrollTo } = await setupList()
    el.scrollTop = 1400 // 2000 - 600 - 1400 = 0，贴底
    render(<Chat {...PROPS} streamingText="正在回答…" />, container)
    await flushEffects()
    expect(scrollTo).toHaveBeenCalled()
  })

  it('用户上翻查看历史时，流式更新不得强制拉回底部', async () => {
    const { el, scrollTo } = await setupList()
    el.scrollTop = 200 // 离底 1200px，明显在上方查看
    render(<Chat {...PROPS} streamingText="正在回答…" />, container)
    await flushEffects()
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
