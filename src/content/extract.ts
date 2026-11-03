import type { PageContent } from '../shared/types'

// 本文件被 chrome.scripting.executeScript({ func }) 序列化注入：
// 函数体内不得引用任何运行时 import（仅允许 import type），必须自包含。

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME', 'CANVAS',
  'NAV', 'FOOTER', 'ASIDE', 'FORM', 'BUTTON', 'SELECT', 'OPTION',
])

const BLOCK_TAGS = new Set([
  'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE',
  'FIGCAPTION', 'TD', 'TH', 'DT', 'DD', 'DIV', 'SECTION', 'ARTICLE',
  'MAIN', 'HEADER', 'UL', 'OL', 'TABLE', 'TR', 'DL', 'BODY',
])

function hasBlockChild(el: Element): boolean {
  return Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName))
}

// 提取当前页面结构化内容（在页面上下文中执行）
export function extractPageContent(): PageContent | null {
  const body = document.body
  if (!body) return null
  const out: string[] = []
  const visit = (el: Element): void => {
    for (const child of Array.from(el.children)) {
      if (SKIP_TAGS.has(child.tagName)) continue
      if (getComputedStyle(child).display === 'none') continue
      const heading = /^H([1-6])$/.exec(child.tagName)
      if (heading) {
        const t = child.textContent?.trim()
        if (t) out.push('\n' + '#'.repeat(Number(heading[1])) + ' ' + t)
        continue
      }
      if (hasBlockChild(child)) {
        visit(child)
        continue
      }
      const t = (child as HTMLElement).innerText?.trim() ?? child.textContent?.trim() ?? ''
      if (t) out.push(t)
    }
  }
  visit(body)
  const text = out
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  // 用 querySelectorAll 而非 document.images（happy-dom 等环境未实现后者，语义等价）
  const images = Array.from(document.querySelectorAll('img'))
    .map((img) => ({
      src: img.src,
      alt: img.alt ?? '',
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    }))
    .filter((im) => im.src !== '' && !im.src.startsWith('chrome-extension://'))
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''
  return { title: document.title, url: location.href, description, text, images }
}
