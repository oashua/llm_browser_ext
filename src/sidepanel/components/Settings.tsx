import { useState } from 'preact/hooks'
import { DEFAULT_SYSTEM_PROMPT } from '../../shared/defaultPrompt'
import { IconBack } from './icons'
import type { McpServerConfig, Settings } from '../../shared/types'

export interface McpStatus {
  name: string
  status: 'idle' | 'connected' | 'error'
  toolCount: number
  error: string
}

export interface SettingsProps {
  settings: Settings
  mcpStatuses: McpStatus[]
  onSave: (s: Settings) => void
  onBack: () => void
}

export function SettingsView(props: SettingsProps) {
  const [form, setForm] = useState<Settings>(props.settings)
  const [headersDraft, setHeadersDraft] = useState<Record<number, string>>(
    Object.fromEntries(props.settings.mcpServers.map((s, i) => [i, JSON.stringify(s.headers ?? {}, null, 2)])),
  )

  function set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    setForm({ ...form, [key]: value })
  }

  function setServer(i: number, patch: Partial<McpServerConfig>): void {
    const next = form.mcpServers.map((s, j) => (j === i ? { ...s, ...patch } : s))
    setForm({ ...form, mcpServers: next })
  }

  function saveServerHeaders(i: number, draft: string): void {
    setHeadersDraft({ ...headersDraft, [i]: draft })
    try {
      setServer(i, { headers: draft.trim() ? JSON.parse(draft) : undefined })
    } catch {
      // JSON 不完整时暂不写入
    }
  }

  return (
    <div class="settings">
      <div class="settings-head">
        <button class="ghost back" onClick={() => props.onBack()}>
          <IconBack />
          返回
        </button>
        <button onClick={() => props.onSave(form)}>保存</button>
      </div>

      <label>
        API Base URL
        <input
          value={form.baseUrl}
          onInput={(e) => set('baseUrl', (e.target as HTMLInputElement).value)}
          placeholder="https://open.bigmodel.cn/api/anthropic"
        />
        <span class="hint">Anthropic 兼容端点的协议根，不要带 /v1。GLM 填 https://open.bigmodel.cn/api/anthropic</span>
      </label>
      <label>
        API Key
        <input type="password" value={form.apiKey} onInput={(e) => set('apiKey', (e.target as HTMLInputElement).value)} />
      </label>
      <label>
        模型名
        <input value={form.model} onInput={(e) => set('model', (e.target as HTMLInputElement).value)} placeholder="claude-sonnet-5" />
      </label>
      <label>
        单页截断字符数
        <input
          type="number"
          value={form.maxPageChars}
          onInput={(e) => set('maxPageChars', Number((e.target as HTMLInputElement).value) || 50000)}
        />
      </label>
      <label class="toggle-row">
        <input
          type="checkbox"
          checked={form.allowTabEnumeration}
          onChange={(e) => set('allowTabEnumeration', (e.target as HTMLInputElement).checked)}
        />
        <span>允许 agent 枚举并读取所有标签页（开放 list_tabs / read_tab 工具；默认关闭以保护隐私，关闭时仅能访问上方勾选的上下文页）</span>
      </label>
      <label>
        系统提示词
        <div class="prompt-row">
          <button class="ghost" onClick={() => set('systemPrompt', DEFAULT_SYSTEM_PROMPT)}>
            恢复默认
          </button>
        </div>
        <textarea
          rows={10}
          value={form.systemPrompt}
          onInput={(e) => set('systemPrompt', (e.target as HTMLTextAreaElement).value)}
        />
      </label>

      <fieldset>
        <legend>MCP Servers（streamable HTTP）</legend>
        {form.mcpServers.map((srv, i) => {
          const st = props.mcpStatuses.find((s) => s.name === srv.name)
          return (
            <div class="mcp-row" key={i}>
              <input value={srv.name} placeholder="名称" onInput={(e) => setServer(i, { name: (e.target as HTMLInputElement).value })} />
              <input
                value={srv.url}
                placeholder="https://…（JSON-RPC 端点）"
                onInput={(e) => setServer(i, { url: (e.target as HTMLInputElement).value })}
              />
              <textarea
                rows={2}
                value={headersDraft[i] ?? '{}'}
                onInput={(e) => saveServerHeaders(i, (e.target as HTMLTextAreaElement).value)}
                placeholder={'请求头 JSON，如 {"Authorization":"Bearer …"}'}
              />
              <span class={`mcp-status ${st?.status ?? 'idle'}`}>
                {st?.status === 'connected'
                  ? `已连接（${st.toolCount} 工具）`
                  : st?.status === 'error'
                    ? `离线: ${st.error.slice(0, 60)}`
                    : '未连接'}
              </span>
              <button class="ghost" onClick={() => setForm({ ...form, mcpServers: form.mcpServers.filter((_, j) => j !== i) })}>
                删除
              </button>
            </div>
          )
        })}
        <button
          class="ghost"
          onClick={() =>
            setForm({ ...form, mcpServers: [...form.mcpServers, { name: `server-${form.mcpServers.length + 1}`, url: '' }] })
          }
        >
          + 添加 MCP Server
        </button>
      </fieldset>
    </div>
  )
}
