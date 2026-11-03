import { describe, expect, it } from 'vitest'
import { createSseParser } from '../src/shared/sse'

describe('createSseParser', () => {
  it('解析单个完整事件', () => {
    const got: string[] = []
    const feed = createSseParser((d) => got.push(d))
    feed('data: {"a":1}\n\n')
    expect(got).toEqual(['{"a":1}'])
  })

  it('跨 chunk 的事件被正确拼接', () => {
    const got: string[] = []
    const feed = createSseParser((d) => got.push(d))
    feed('data: {"a"')
    feed(':1}\n\ndata: {"b":2}\n\n')
    expect(got).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('忽略注释行与非 data 行', () => {
    const got: string[] = []
    const feed = createSseParser((d) => got.push(d))
    feed(': keepalive\nevent: message\ndata: x\n\n')
    expect(got).toEqual(['x'])
  })

  it('CRLF 行尾兼容', () => {
    const got: string[] = []
    const feed = createSseParser((d) => got.push(d))
    feed('data: y\r\n\r\n')
    expect(got).toEqual(['y'])
  })
})
