import { useEffect, useRef, useState } from 'preact/hooks'
import { buildSystemPrompt } from './agent/context'
import { runAgentLoop } from './agent/loop'
import { McpClient } from './agent/mcp/client'
import { fetchPageContent } from './agent/tools/pageContent'
import { builtinTools } from './agent/tools/registry'
import { Chat } from './components/Chat'
import { IconSettings } from './components/icons'
import { lastUserQuery } from './components/lastUser'
import { SettingsView, type McpStatus } from './components/Settings'
import { TabPicker, type PickerTab } from './components/TabPicker'
import { clearSession, getSession, getSettings, saveSession, saveSettings } from '../shared/storage'
import type { SessionState, Settings, WireMessage } from '../shared/types'

export function App() {
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [session, setSession] = useState<SessionState>({ messages: [], contextTabIds: [] })
  const [tabs, setTabs] = useState<PickerTab[]>([])
  const [streaming, setStreaming] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [mcpStatuses, setMcpStatuses] = useState<McpStatus[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const mcpRef = useRef<McpClient[]>([])

  const refreshTabs = async (): Promise<void> => {
    const all = await chrome.tabs.query({})
    setTabs(all.filter((t) => t.id != null).map((t) => ({ id: t.id!, title: t.title ?? '', url: t.url ?? '' })))
  }

  async function connectMcp(s: Settings): Promise<void> {
    const clients: McpClient[] = []
    const statuses: McpStatus[] = []
    for (const cfg of s.mcpServers) {
      if (!cfg.url) continue
      const client = new McpClient(cfg)
      try {
        await client.connect()
        statuses.push({ name: cfg.name, status: 'connected', toolCount: client.tools.length, error: '' })
      } catch (e) {
        statuses.push({ name: cfg.name, status: 'error', toolCount: 0, error: e instanceof Error ? e.message : String(e) })
      }
      clients.push(client)
    }
    mcpRef.current = clients
    setMcpStatuses(statuses)
  }

  useEffect(() => {
    void (async () => {
      const [s, sess] = await Promise.all([getSettings(), getSession()])
      setSettings(s)
      // 标签页 ID 重启后不稳定：过滤已不存在的
      const all = await chrome.tabs.query({})
      const validIds = new Set(all.filter((t) => t.id != null).map((t) => t.id!))
      const contextTabIds = sess.contextTabIds.filter((id) => validIds.has(id))
      const active = all.find((t) => t.active && t.windowId === chrome.windows.WINDOW_ID_CURRENT)
      // 首次使用（无历史上下文）默认选当前活动标签页
      let initialContext = contextTabIds
      if (!sess.contextTabIds.length && active?.id != null) initialContext = [active.id]
      setSession({ messages: sess.messages, contextTabIds: initialContext })
      void refreshTabs()
      void connectMcp(s)
    })()
    const onTabChange = (): void => {
      void refreshTabs()
    }
    chrome.tabs.onActivated.addListener(onTabChange)
    chrome.tabs.onUpdated.addListener(onTabChange)
    chrome.tabs.onRemoved.addListener(onTabChange)
    return () => {
      chrome.tabs.onActivated.removeListener(onTabChange)
      chrome.tabs.onUpdated.removeListener(onTabChange)
      chrome.tabs.onRemoved.removeListener(onTabChange)
    }
  }, [])

  async function persistSession(next: SessionState): Promise<void> {
    setSession(next)
    await saveSession(next)
  }

  async function send(text: string): Promise<void> {
    if (!settings || running) return
    if (!settings.apiKey || !settings.baseUrl) {
      setError('请先在设置中配置 API 端点与密钥')
      setView('settings')
      return
    }
    setError('')
    const history: WireMessage[] = [
      ...session.messages,
      { role: 'user', content: [{ type: 'text', text }] },
    ]
    const acc = [...history] // 已完成消息累积（含多轮 assistant），失败/中断时据此持久化
    setSession((s) => ({ ...s, messages: history }))
    setStreaming('')
    setRunning(true)
    try {
      const validIds = new Set(tabs.map((t) => t.id))
      const contextIds = session.contextTabIds.filter((id) => validIds.has(id))
      const pages = []
      for (const id of contextIds) {
        try {
          pages.push(await fetchPageContent(id))
        } catch {
          // 失效标签页跳过
        }
      }
      const system = buildSystemPrompt(settings.systemPrompt, pages, settings.maxPageChars)
      const tools = [...builtinTools(), ...mcpRef.current.flatMap((c) => c.toolDefs())]
      const ac = new AbortController()
      abortRef.current = ac
      const returned = await runAgentLoop({
        settings,
        system,
        history,
        tools,
        ctx: { settings, currentTabId: contextIds[0] },
        signal: ac.signal,
        on: {
          textDelta: (t) => setStreaming((s) => s + t),
          assistant: (m) => {
            acc.push(m)
            setStreaming('')
            setSession((s) => ({ ...s, messages: [...acc] }))
          },
        },
      })
      await persistSession({ messages: returned, contextTabIds: contextIds })
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') setError('已停止')
      else setError(e instanceof Error ? e.message : String(e))
      await persistSession({ messages: acc, contextTabIds: session.contextTabIds })
    } finally {
      setRunning(false)
      setStreaming('')
      abortRef.current = null
    }
  }

  async function retry(): Promise<void> {
    const last = lastUserQuery(session.messages)
    if (!last) return
    const trimmed = session.messages.slice(0, last.cutoff)
    setSession({ ...session, messages: trimmed })
    await send(last.text)
  }

  function toggleTab(id: number): void {
    const next = session.contextTabIds.includes(id)
      ? session.contextTabIds.filter((x) => x !== id)
      : [...session.contextTabIds, id]
    void persistSession({ ...session, contextTabIds: next })
  }

  async function clearAll(): Promise<void> {
    await clearSession()
    setSession({ messages: [], contextTabIds: [] })
  }

  async function saveAndReconnect(s: Settings): Promise<void> {
    setSettings(s)
    await saveSettings(s)
    await connectMcp(s)
    setView('chat')
  }

  if (!settings) return <div style="padding:12px">加载中…</div>

  return (
    <div class="app">
      <header class="topbar">
        <TabPicker tabs={tabs} selected={session.contextTabIds} onToggle={toggleTab} />
        <span class="spacer" />
        <span class="model-tag" title={settings.baseUrl}>
          {settings.model}
        </span>
        <button class="icon-btn ghost" title="设置" onClick={() => setView(view === 'chat' ? 'settings' : 'chat')}>
          <IconSettings />
        </button>
      </header>
      {view === 'chat' ? (
        <Chat
          messages={session.messages}
          streamingText={streaming}
          running={running}
          error={error}
          onSend={(t) => void send(t)}
          onStop={() => abortRef.current?.abort()}
          onRetry={() => void retry()}
          onClear={() => void clearAll()}
        />
      ) : (
        <SettingsView
          settings={settings}
          mcpStatuses={mcpStatuses}
          onSave={(s) => void saveAndReconnect(s)}
          onBack={() => setView('chat')}
        />
      )}
    </div>
  )
}
