import { describe, expect, it } from 'vitest'
import { traceOutputFromResult } from '../src/sidepanel/components/traceOutput'
import type { ToolResultBlock } from '../src/shared/types'

const img = { type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg', data: 'QUJD' } }

describe('traceOutputFromResult', () => {
  it('字符串 content 直接作为文本', () => {
    const r = { type: 'tool_result', tool_use_id: 't', content: '纯文本结果' } as ToolResultBlock
    expect(traceOutputFromResult(r)).toEqual({ text: '纯文本结果', images: undefined, isError: undefined })
  })
  it('数组 content 拆分文本与图片块', () => {
    const r = {
      type: 'tool_result',
      tool_use_id: 't',
      content: [{ type: 'text', text: '已附加截图。' }, img],
    } as unknown as ToolResultBlock
    const out = traceOutputFromResult(r)
    expect(out.text).toBe('已附加截图。')
    expect(out.images).toEqual([img])
  })
  it('保留 is_error 标记', () => {
    const r = { type: 'tool_result', tool_use_id: 't', content: 'x', is_error: true } as ToolResultBlock
    expect(traceOutputFromResult(r).isError).toBe(true)
  })
})
