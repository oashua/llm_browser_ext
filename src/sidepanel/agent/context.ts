import { truncateText } from '../../shared/truncate'
import type { PageContent } from '../../shared/types'

// 把页面内容格式化为标注块；超长时截断（扣除头部开销）
export function formatPageContent(pc: PageContent, maxChars: number): string {
  const head = `# ${pc.title}\nURL: ${pc.url}${pc.description ? `\n摘要: ${pc.description}` : ''}\n\n`
  const { text, truncated } = truncateText(pc.text, Math.max(0, maxChars - head.length))
  const tail = truncated ? `\n\n[内容超长，已截断，原文约 ${pc.text.length} 字符]` : ''
  return `<page>\n${head}${text}${tail}\n</page>`
}

export function buildSystemPrompt(base: string, pages: PageContent[], maxChars: number): string {
  if (!pages.length) return base
  const blocks = pages.map((pc) => formatPageContent(pc, maxChars)).join('\n\n')
  return `${base}\n\n# 用户选择的上下文标签页\n\n${blocks}`
}
