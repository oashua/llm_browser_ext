import { afterEach, describe, expect, it } from 'vitest'
import { installChromeMock } from './mocks/chrome'
import { formatPageContent } from '../src/sidepanel/agent/context'
import { fetchPageContent } from '../src/sidepanel/agent/tools/pageContent'
import { dispatchTool } from '../src/sidepanel/agent/tools/registry'
import type { Settings, ToolContext } from '../src/shared/types'

afterEach(() => {
  delete (globalThis as Record<string, unknown>).chrome
})

const settings: Settings = {
  baseUrl: '', apiKey: '', model: '', systemPrompt: '', mcpServers: [], maxPageChars: 50000,
}
const ctx: ToolContext = { settings, currentTabId: 1 }

const page = {
  title: 'T', url: 'https://a.com', description: '', text: '正文', images: [],
}

function mockChromeForTabs(): void {
  installChromeMock({
    tabs: {
      query: async () => [
        { id: 1, title: '标签一', url: 'https://a.com', active: true },
        { id: 2, title: '标签二', url: 'https://b.com', active: false },
      ],
      get: async (id: number) => ({ id, title: 't', url: id === 2 ? 'chrome://settings' : 'https://a.com' }),
    },
    scripting: {
      executeScript: async () => [{ result: page }],
    },
  })
}

describe('fetchPageContent', () => {
  it('默认取当前活动标签页并注入提取', async () => {
    mockChromeForTabs()
    const pc = await fetchPageContent()
    expect(pc.text).toBe('正文')
  })
  it('chrome:// 内部页面拒绝提取', async () => {
    mockChromeForTabs()
    await expect(fetchPageContent(2)).rejects.toThrow('不支持内容提取')
  })
})

describe('dispatchTool', () => {
  it('list_tabs 输出全部标签页', async () => {
    mockChromeForTabs()
    const out = await dispatchTool('list_tabs', {}, ctx, [])
    expect(out.text).toContain('[1](当前) 标签一')
    expect(out.text).toContain('[2] 标签二')
    expect(out.isError).toBeFalsy()
  })
  it('get_page_content 输出格式化页面', async () => {
    mockChromeForTabs()
    const out = await dispatchTool('get_page_content', {}, ctx, [])
    expect(out.text).toBe(formatPageContent(page, 50000))
  })
  it('未知工具返回错误输出', async () => {
    mockChromeForTabs()
    const out = await dispatchTool('nope', {}, ctx, [])
    expect(out.isError).toBe(true)
  })
  it('外部工具（MCP 命名空间）正常分发', async () => {
    mockChromeForTabs()
    const fake = {
      name: 'mcp__srv__echo', description: '', inputSchema: {},
      execute: async (args: Record<string, unknown>) => ({ text: String(args.v) }),
    }
    const out = await dispatchTool('mcp__srv__echo', { v: 42 }, ctx, [fake])
    expect(out.text).toBe('42')
  })
})
