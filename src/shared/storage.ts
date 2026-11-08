import { DEFAULT_SYSTEM_PROMPT } from './defaultPrompt'
import type { SessionState, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.anthropic.com',
  apiKey: '',
  model: 'claude-sonnet-5',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  mcpServers: [],
  maxPageChars: 50000,
  allowTabEnumeration: false,
  contextUseRawHtml: false,
}

export async function getSettings(): Promise<Settings> {
  const { settings } = (await chrome.storage.local.get('settings')) as { settings?: Partial<Settings> }
  const merged = { ...DEFAULT_SETTINGS, ...(settings ?? {}) }
  // 用户未自定义提示词（空串）时回填默认
  merged.systemPrompt = merged.systemPrompt || DEFAULT_SYSTEM_PROMPT
  return merged
}

export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set({ settings: s })
}

export async function getSession(): Promise<SessionState> {
  const { session } = (await chrome.storage.local.get('session')) as { session?: SessionState }
  return session ?? { messages: [], contextTabIds: [] }
}

export async function saveSession(s: SessionState): Promise<void> {
  await chrome.storage.local.set({ session: s })
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove('session')
}

const SETTINGS_KEYS = [
  'baseUrl', 'apiKey', 'model', 'systemPrompt', 'mcpServers', 'maxPageChars',
  'allowTabEnumeration', 'contextUseRawHtml',
] as const

// 解析导入的配置 JSON：宽松合并默认值、过滤非法 mcpServers；结构不对返回 null
export function parseSettings(json: string): Settings | null {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const o = raw as Partial<Settings>
  // 至少含一个已知字段才认为是配置文件
  if (!SETTINGS_KEYS.some((k) => k in o)) return null
  const merged: Settings = { ...DEFAULT_SETTINGS, ...o }
  merged.systemPrompt = merged.systemPrompt || DEFAULT_SETTINGS.systemPrompt
  if (!Array.isArray(merged.mcpServers)) merged.mcpServers = []
  merged.mcpServers = merged.mcpServers.filter(
    (s) => typeof s?.name === 'string' && typeof s?.url === 'string',
  ) as Settings['mcpServers']
  return merged
}
