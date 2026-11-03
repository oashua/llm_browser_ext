import { extractPageContent } from '../../../content/extract'
import { formatPageContent } from '../context'
import type { PageContent, ToolContext, ToolDef } from '../../../shared/types'

const UNREADABLE_PREFIXES = [
  'chrome://', 'edge://', 'about:', 'chrome-extension://', 'devtools://',
  'https://chromewebstore.google.com', 'https://chrome.google.com/webstore',
]

// 提取指定标签页（默认当前活动页）内容；内部页面抛错
export async function fetchPageContent(tabId?: number): Promise<PageContent> {
  let id = tabId
  if (id == null) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
    id = active?.id
  }
  if (id == null) throw new Error('找不到目标标签页')
  const tab = await chrome.tabs.get(id)
  if (UNREADABLE_PREFIXES.some((p) => tab.url?.startsWith(p)))
    throw new Error(`页面 ${tab.url ?? ''} 不支持内容提取（浏览器内部页面）`)
  const [res] = await chrome.scripting.executeScript({ target: { tabId: id }, func: extractPageContent })
  if (!res?.result) throw new Error('页面内容提取失败（页面可能尚未加载完成）')
  return res.result as PageContent
}

export const pageContentTool: ToolDef = {
  name: 'get_page_content',
  description: '获取指定标签页的结构化正文（标题、URL、摘要、正文）。默认当前活动标签页；先用 list_tabs 查 tabId。',
  inputSchema: {
    type: 'object',
    properties: { tabId: { type: 'number', description: '目标标签页 ID，默认当前标签页' } },
  },
  execute: async (args, ctx: ToolContext) => ({
    text: formatPageContent(await fetchPageContent(args.tabId as number | undefined), ctx.settings.maxPageChars),
  }),
}

export const readTabTool: ToolDef = {
  name: 'read_tab',
  description: '读取指定标签页完整内容并加入当前对话上下文，用于需要参考其他页面时。',
  inputSchema: {
    type: 'object',
    properties: { tabId: { type: 'number', description: '目标标签页 ID（必填）' } },
    required: ['tabId'],
  },
  execute: async (args, ctx) => ({
    text: formatPageContent(await fetchPageContent(args.tabId as number), ctx.settings.maxPageChars),
  }),
}
