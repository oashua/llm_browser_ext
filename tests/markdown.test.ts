// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/sidepanel/components/Markdown'

describe('renderMarkdown', () => {
  it('渲染基本 markdown', () => {
    const html = renderMarkdown('**加粗** 与 `code`')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<code>code</code>')
  })
  it('移除 script 标签与事件属性防 XSS', () => {
    const html = renderMarkdown('hi <script>alert(1)</script><img src=x onerror=alert(2)>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
  })
})
