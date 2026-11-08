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
  baseUrl: '', apiKey: '', model: '', systemPrompt: '', mcpServers: [], maxPageChars: 50000, allowTabEnumeration: false, contextUseRawHtml: false,
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
      executeScript: async (inj: { args?: unknown[] }) =>
        // 按注入参数分流：带 selector 的走 HTML 提取，否则走内容提取
        [{ result: inj.args?.length ? '<main>正文</main>' : page }],
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
  it('标签页枚举开关：默认关闭，开启后 list_tabs/read_tab 可用', async () => {
    mockChromeForTabs()
    // 默认（allowTabEnumeration 缺省为 false）：不可用
    const off = await dispatchTool('list_tabs', {}, ctx, [])
    expect(off.isError).toBe(true)
    // 开启后：可枚举
    const onCtx = { ...ctx, settings: { ...settings, allowTabEnumeration: true } }
    const on = await dispatchTool('list_tabs', {}, onCtx, [])
    expect(on.isError).toBeFalsy()
    expect(on.text).toContain('标签一')
    // read_tab 走注入提取
    const read = await dispatchTool('read_tab', { tabId: 1 }, onCtx, [])
    expect(read.isError).toBeFalsy()
    expect(read.text).toContain('正文')
  })
  it('get_page_content 输出格式化页面', async () => {
    mockChromeForTabs()
    const out = await dispatchTool('get_page_content', {}, ctx, [])
    expect(out.text).toBe(formatPageContent(page, 50000))
  })
  it('get_page_html 返回 HTML 块；选择器无匹配报错', async () => {
    mockChromeForTabs()
    const out = await dispatchTool('get_page_html', { selector: 'main' }, ctx, [])
    expect(out.isError).toBeFalsy()
    expect(out.text).toContain('<page-html selector="main"')
    expect(out.text).toContain('<main>正文</main>')
    // 无匹配（executeScript 返回 null → 非 string）
    const chrome2 = (globalThis as any).chrome
    chrome2.scripting.executeScript = async () => [{ result: null }]
    const miss = await dispatchTool('get_page_html', { selector: '.x' }, ctx, [])
    expect(miss.isError).toBe(true)
    expect(miss.text).toContain('未匹配到元素')
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

describe('settings 工具', () => {
  const base: Settings = { ...settings, apiKey: 'sk-secret', model: 'glm-4.6' }

  it('get_settings 脱敏 apiKey', async () => {
    const out = await dispatchTool('get_settings', {}, { settings: base }, [])
    expect(out.text).not.toContain('sk-secret')
    expect(out.text).toContain('glm-4.6')
  })

  it('update_settings 应用 patch 并回显新配置', async () => {
    const applied: unknown[] = []
    const out = await dispatchTool(
      'update_settings',
      { model: 'glm-4.7', maxPageChars: 20000 },
      {
        settings: base,
        updateSettings: async (patch) => {
          applied.push(patch)
          return { ...base, ...patch }
        },
      },
      [],
    )
    expect(out.isError).toBeFalsy()
    expect(applied).toEqual([{ model: 'glm-4.7', maxPageChars: 20000 }])
    expect(out.text).toContain('glm-4.7')
    expect(out.text).not.toContain('sk-secret')
  })

  it('update_settings 拒绝修改 apiKey/baseUrl', async () => {
    for (const key of ['apiKey', 'baseUrl']) {
      const out = await dispatchTool('update_settings', { [key]: 'x' }, { settings: base }, [])
      expect(out.isError).toBe(true)
      expect(out.text).toContain(key)
    }
  })

  it('update_settings 拒绝未知字段与非法类型', async () => {
    const bad = await dispatchTool('update_settings', { nope: 1 }, { settings: base }, [])
    expect(bad.isError).toBe(true)
    expect(bad.text).toContain('未知配置项')
    const badType = await dispatchTool('update_settings', { model: 123 }, { settings: base }, [])
    expect(badType.isError).toBe(true)
    expect(badType.text).toContain('model')
    const badMcp = await dispatchTool('update_settings', { mcpServers: [{ name: 'x' }] }, { settings: base }, [])
    expect(badMcp.isError).toBe(true)
  })

  it('update_settings 未注入回调时报错', async () => {
    const out = await dispatchTool('update_settings', { model: 'm' }, { settings: base }, [])
    expect(out.isError).toBe(true)
  })
})
