import { afterEach, describe, expect, it } from 'vitest'
import { installChromeMock } from './mocks/chrome'
import { DEFAULT_SETTINGS, clearSession, getSession, getSettings, saveSession, saveSettings } from '../src/shared/storage'

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
