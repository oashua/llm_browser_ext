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
