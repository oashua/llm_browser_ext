import { afterEach, describe, expect, it } from 'vitest'
import { installChromeMock } from './mocks/chrome'
import { DEFAULT_SETTINGS, clearSession, getSession, getSettings, parseSettings, saveSession, saveSettings } from '../src/shared/storage'

describe('parseSettings（导入解析）', () => {
  it('合法 JSON 宽松合并默认值', () => {
    const s = parseSettings(JSON.stringify({ model: 'glm-4.7', mcpServers: [{ name: 'a', url: 'https://x' }] }))
    expect(s?.model).toBe('glm-4.7')
    expect(s?.baseUrl).toBe(DEFAULT_SETTINGS.baseUrl)
    expect(s?.mcpServers).toHaveLength(1)
  })
  it('坏 JSON / 非对象 / 无已知字段返回 null', () => {
    expect(parseSettings('{bad json')).toBeNull()
    expect(parseSettings('"str"')).toBeNull()
    expect(parseSettings('[1,2]')).toBeNull()
    expect(parseSettings(JSON.stringify({ unknown: 1 }))).toBeNull()
  })
  it('mcpServers 非法结构被过滤，空 systemPrompt 回填默认', () => {
    const s = parseSettings(JSON.stringify({ model: 'm', mcpServers: 'oops' }))
    expect(s?.mcpServers).toEqual([])
    expect(s?.systemPrompt).toBe(DEFAULT_SETTINGS.systemPrompt)
  })
})

afterEach(() => {
  delete (globalThis as Record<string, unknown>).chrome
})

describe('storage', () => {
  it('未保存时返回默认设置且系统提示词回填默认值', async () => {
    installChromeMock()
    const s = await getSettings()
    expect(s.baseUrl).toBe(DEFAULT_SETTINGS.baseUrl)
    expect(s.maxPageChars).toBe(50000)
    expect(s.systemPrompt.length).toBeGreaterThan(100)
  })

  it('保存后读取保留用户值，空 systemPrompt 回填默认', async () => {
    installChromeMock()
    await saveSettings({ ...DEFAULT_SETTINGS, apiKey: 'sk-1', model: 'glm-4.7', systemPrompt: '' })
    const s = await getSettings()
    expect(s.apiKey).toBe('sk-1')
    expect(s.model).toBe('glm-4.7')
    expect(s.systemPrompt).toBe(DEFAULT_SETTINGS.systemPrompt)
  })

  it('session 默认为空，保存后可读回，clear 后恢复空', async () => {
    installChromeMock()
    expect(await getSession()).toEqual({ messages: [], contextTabIds: [] })
    await saveSession({ messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }], contextTabIds: [3] })
    const s = await getSession()
    expect(s.contextTabIds).toEqual([3])
    await clearSession()
    expect(await getSession()).toEqual({ messages: [], contextTabIds: [] })
  })
})
