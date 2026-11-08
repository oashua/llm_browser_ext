import { describe, expect, it } from 'vitest'
import { composeSystem, formatPageContent, formatPageHtml, tabAccessNote } from '../src/sidepanel/agent/context'
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

describe('formatPageHtml', () => {
  const html = '<div>' + 'x'.repeat(500) + '</div>'
  it('整页模式标注字节数并包裹标签', () => {
    const out = formatPageHtml(html, '', 10000)
    expect(out).toContain('<page-html bytes="511">')
    expect(out).toContain('</page-html>')
    expect(out).toContain('x'.repeat(500))
  })
  it('selector 模式标注选择器', () => {
    const out = formatPageHtml('<main>y</main>', 'main', 10000)
    expect(out).toContain('selector="main"')
  })
  it('超长截断并提示用 selector 缩小范围', () => {
    const out = formatPageHtml(html, '', 100)
    expect(out).not.toContain('x'.repeat(500))
    expect(out).toContain('HTML 超长已截断')
    expect(out).toContain('selector')
  })
})

describe('composeSystem', () => {
  it('有页面块时拼接提示词与 Tab access 说明', () => {
    const out = composeSystem('BASE', '<page>x</page>', true)
    expect(out.startsWith('BASE')).toBe(true)
    expect(out).toContain('# 用户选择的上下文标签页')
    expect(out).toContain('<page>x</page>')
    expect(out).toContain('list_tabs')
  })
  it('无页面块时仅提示词与说明', () => {
    const out = composeSystem('BASE', '', false)
    expect(out.startsWith('BASE')).toBe(true)
    expect(out).not.toContain('用户选择的上下文标签页')
    expect(out).toContain('disabled')
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
