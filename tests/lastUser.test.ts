import { describe, expect, it } from 'vitest'
import { lastUserQuery } from '../src/sidepanel/components/lastUser'

describe('lastUserQuery', () => {
  it('找到最后一条含文本的用户消息与其截断点', () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: '第一问' }] },
      { role: 'assistant', content: [{ type: 'text', text: '答' }] },
      { role: 'user', content: [{ type: 'text', text: '第二问' }] },
      { role: 'assistant', content: [{ type: 'text', text: '答2' }] },
    ] as any
    expect(lastUserQuery(messages)).toEqual({ text: '第二问', cutoff: 2 })
  })
  it('没有用户文本消息时返回 null', () => {
    const messages = [{ role: 'assistant', content: [{ type: 'text', text: 'hi' }] }] as any
    expect(lastUserQuery(messages)).toBeNull()
  })
})
