import { describe, expect, it } from 'vitest'
import { truncateText } from '../src/shared/truncate'

describe('truncateText', () => {
  it('未超长时原样返回', () => {
    expect(truncateText('abc', 10)).toEqual({ text: 'abc', truncated: false })
  })
  it('恰好等于上限不截断', () => {
    expect(truncateText('abcd', 4)).toEqual({ text: 'abcd', truncated: false })
  })
  it('超长时截断到上限并标记', () => {
    const r = truncateText('abcdef', 3)
    expect(r).toEqual({ text: 'abc', truncated: true })
  })
  it('上限为 0 返回空串', () => {
    expect(truncateText('abc', 0)).toEqual({ text: '', truncated: true })
  })
})
