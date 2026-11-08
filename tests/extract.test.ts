// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { extractPageContent } from '../src/content/extract'

function setupDom(): void {
  document.body.innerHTML = `
    <nav>导航 首页 关于</nav>
    <script>var x = 1</script>
    <main>
      <h1>页面主标题</h1>
      <p>第一段正文，包含 <a href="/x">链接文字</a>。</p>
      <div>
        <h2>小节</h2>
        <p>第二段正文。</p>
        <img src="https://img.example.com/pic.png" alt="示意图" width="800" height="600">
        <img src="https://img.example.com/icon.png" style="display:none" width="16" height="16">
      </div>
    </main>
    <meta name="description" content="页面描述">
  `
  document.title = '测试页'
}

describe('extractPageContent', () => {
  it('提取标题/URL/摘要/正文并保留标题层级', () => {
    setupDom()
    const pc = extractPageContent()!
    expect(pc.title).toBe('测试页')
    expect(pc.url).toBe(location.href)
    expect(pc.description).toBe('页面描述')
    expect(pc.text).toContain('# 页面主标题')
    expect(pc.text).toContain('## 小节')
    expect(pc.text).toContain('第一段正文，包含 链接文字。')
    expect(pc.text).toContain('第二段正文。')
    expect(pc.text).not.toContain('导航')
    expect(pc.text).not.toContain('var x')
  })

  it('收集可见图片信息', () => {
    setupDom()
    const pc = extractPageContent()!
    const srcs = pc.images.map((im) => im.src)
    expect(srcs).toContain('https://img.example.com/pic.png')
    // display:none 的图片仍在 document.images 中，但尺寸信息保留（过滤在取图阶段做）
    expect(pc.images.length).toBe(2)
  })

  it('自包含：脱离模块作用域仍可执行（executeScript 序列化安全）', () => {
    setupDom()
    // 模拟 chrome.scripting.executeScript({func})：只有函数源码被带走，
    // 模块级常量/辅助函数不可见——引用它们会 ReferenceError
    const run = new Function(`"use strict"; return (${extractPageContent.toString()})();`) as
      () => ReturnType<typeof extractPageContent>
    const pc = run()!
    expect(pc.title).toBe('测试页')
    expect(pc.text).toContain('# 页面主标题')
    expect(pc.text).toContain('第二段正文。')
    expect(pc.text).not.toContain('导航')
  })
})
