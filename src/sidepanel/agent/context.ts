import { truncateText } from '../../shared/truncate'
import type { PageContent } from '../../shared/types'

// 把页面内容格式化为标注块；超长时截断（扣除头部开销）
export function formatPageContent(pc: PageContent, maxChars: number): string {
  const head = `# ${pc.title}\nURL: ${pc.url}${pc.description ? `\n摘要: ${pc.description}` : ''}\n\n`
  const { text, truncated } = truncateText(pc.text, Math.max(0, maxChars - head.length))
  const tail = truncated ? `\n\n[内容超长，已截断，原文约 ${pc.text.length} 字符]` : ''
  return `<page>\n${head}${text}${tail}\n</page>`
}

// 完整 HTML 上下文块：标注字节数，超长截断并提示缩小范围
export function formatPageHtml(html: string, selector: string, maxChars: number): string {
  const head = `<page-html${selector ? ` selector="${selector}"` : ''} bytes="${html.length}">\n`
  const { text, truncated } = truncateText(html, Math.max(0, maxChars - head.length))
  const tail = truncated ? `\n[HTML 超长已截断，原文 ${html.length} 字符；建议用 get_page_html 的 selector 参数缩小范围]` : ''
  return `${head}${text}${tail}\n</page-html>`
}

// 组装最终 system：基础提示词 + 上下文页块 + 标签页权限说明
export function composeSystem(prompt: string, pagesSection: string, allowTabEnumeration: boolean): string {
  const pages = pagesSection ? `${prompt}\n\n# 用户选择的上下文标签页\n\n${pagesSection}` : prompt
  return pages + tabAccessNote(allowTabEnumeration)
}

// 标签页访问权限说明（随 allowTabEnumeration 开关动态附加到 system）
export function tabAccessNote(enabled: boolean): string {
  return enabled
    ? '\n\n# Tab access\nlist_tabs and read_tab are enabled: you may list all browser tabs and read any tab by tabId when it helps answer.'
    : '\n\n# Tab access\nlist_tabs/read_tab are disabled. The context contains only tabs the user selected; if asked about other tabs, tell the user to select them in the tab picker.';
}
