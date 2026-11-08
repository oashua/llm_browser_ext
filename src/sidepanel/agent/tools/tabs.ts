import type { ToolDef } from '../../../shared/types'

export const listTabsTool: ToolDef = {
  name: 'list_tabs',
  description: '列出浏览器全部标签页（ID、标题、URL、是否活动）。用于在 read_tab / get_page_content 前查找 tabId。',
  inputSchema: { type: 'object', properties: {} },
  execute: async (_args, ctx) => {
    const tabs = await chrome.tabs.query({})
    const lines = tabs.map(
      (t) => `- [${t.id}]${t.active ? '(当前)' : ''} ${t.title ?? ''}\n  ${t.url ?? ''}`,
    )
    const note = ctx.currentTabId != null ? `\n\n侧边栏默认上下文标签页 ID: ${ctx.currentTabId}` : ''
    return { text: `浏览器标签页：\n${lines.join('\n')}${note}` }
  },
}
