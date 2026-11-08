import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, formatPageContent, tabAccessNote } from '../src/sidepanel/agent/context'
import type { PageContent } from '../src/shared/types'

const pc: PageContent = {
  title: '示例页',
  url: 'https://example.com/a',
  description: '描述',
  text: 'A'.repeat(300),
  images: [],
}

describe('formatPageContent', () => {
  it('包含标题/URL/摘要与正文，包裹 page 标签', () => {
    const out = formatPageContent(pc, 10000)
    expect(out).toContain('<page>')
    expect(out).toContain('# 示例页')
    expect(out).toContain('URL: https://example.com/a')
    expect(out).toContain('摘要: 描述')
    expect(out).toContain('A'.repeat(300))
  })
  it('超长截断并标注原始长度', () => {
    const out = formatPageContent(pc, 100)
    expect(out).not.toContain('A'.repeat(300))
    expect(out).toContain('[内容超长，已截断，原文约 300 字符]')
    expect(out.length).toBeLessThan(200)
  })
})

describe('buildSystemPrompt', () => {
  it('无页面时返回原提示词', () => {
    expect(buildSystemPrompt('BASE', [], 1000)).toBe('BASE')
  })
  it('多个页面依次拼接', () => {
    const out = buildSystemPrompt('BASE', [pc, { ...pc, title: '第二页' }], 10000)
    expect(out.startsWith('BASE')).toBe(true)
    expect(out).toContain('# 示例页')
    expect(out).toContain('# 第二页')
  })
})

describe('tabAccessNote', () => {
  it('开启时说明工具可用', () => {
    const note = tabAccessNote(true)
    expect(note).toContain('list_tabs')
    expect(note).toContain('read_tab')
  })
  it('关闭时引导用户勾选标签页', () => {
    const note = tabAccessNote(false)
    expect(note).toContain('disabled')
    expect(note).not.toContain('may list all tabs')
  })
})
