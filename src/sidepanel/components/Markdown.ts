import DOMPurify from 'dompurify'
import { marked } from 'marked'

// markdown → 净化后的 HTML（模型输出不可信，必须过 DOMPurify）
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(raw)
}
