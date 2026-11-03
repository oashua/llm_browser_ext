// 简易内存版 chrome.storage.local + 各任务自行扩展的 chrome API 注入点
export function installChromeMock(overrides: Record<string, unknown> = {}): Map<string, unknown> {
  const store = new Map<string, unknown>()
  const chromeMock = {
    storage: {
      local: {
        get: async (key: string) => (store.has(key) ? { [key]: store.get(key) } : {}),
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) store.set(k, v)
        },
        remove: async (key: string) => {
          store.delete(key)
        },
      },
    },
    ...overrides,
  }
  ;(globalThis as Record<string, unknown>).chrome = chromeMock
  return store
}
