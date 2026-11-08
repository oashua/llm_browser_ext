import { describe, expect, it } from 'vitest'
import { maskHeadersJson, mergeMaskedHeaders } from '../src/shared/headers'

describe('maskHeadersJson', () => {
  it('敏感头的值替换为 ***，普通头保留', () => {
    const out = maskHeadersJson({ Authorization: 'Bearer sk-123', 'X-Api-Key': 'abc', Accept: 'json' })
    expect(out).toContain('"***"')
    expect(out).toContain('Accept')
    expect(out).not.toContain('sk-123')
    expect(out).not.toContain('abc')
  })
  it('空/undefined 输出 {}', () => {
    expect(maskHeadersJson(undefined)).toBe('{}')
    expect(maskHeadersJson({})).toBe('{}')
  })
})

describe('mergeMaskedHeaders', () => {
  const original = { Authorization: 'Bearer sk-123', Accept: 'json' }
  it('*** 值回填原始密钥', () => {
    expect(mergeMaskedHeaders(original, JSON.stringify({ Authorization: '***', Accept: 'json' }))).toEqual({
      headers: original,
      valid: true,
    })
  })
  it('非敏感值修改生效', () => {
    const out = mergeMaskedHeaders(original, JSON.stringify({ Authorization: '***', Accept: 'xml' }))
    expect(out.headers).toEqual({ Authorization: 'Bearer sk-123', Accept: 'xml' })
  })
  it('新增字段/删除字段按草稿为准', () => {
    const out = mergeMaskedHeaders(original, JSON.stringify({ Authorization: '***', 'X-Extra': '1' }))
    expect(out.headers).toEqual({ Authorization: 'Bearer sk-123', 'X-Extra': '1' })
  })
  it('换密钥：写新值而非 *** 时生效', () => {
    const out = mergeMaskedHeaders(original, JSON.stringify({ Authorization: 'Bearer new-456' }))
    expect(out.headers).toEqual({ Authorization: 'Bearer new-456' })
  })
  it('空草稿=清空（valid）；坏 JSON=不写入（invalid）', () => {
    expect(mergeMaskedHeaders(original, '')).toEqual({ headers: undefined, valid: true })
    expect(mergeMaskedHeaders(original, '  ').valid).toBe(true)
    expect(mergeMaskedHeaders(original, '{bad').valid).toBe(false)
  })
})
