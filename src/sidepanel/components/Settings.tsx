import { useState } from 'preact/hooks'
import { listModels } from '../agent/anthropic'
import { DEFAULT_SYSTEM_PROMPT } from '../../shared/defaultPrompt'
import { maskHeadersJson, mergeMaskedHeaders } from '../../shared/headers'
import { parseSettings } from '../../shared/storage'
import type { McpServerConfig, Settings } from '../../shared/types'
import { IconBack, IconEye } from './icons'

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
  onImport: (s: Settings) => void
  onBack: () => void
}

function exportSettings(s: Settings): void {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'llm-sidebar-config.json'
  a.click()
  URL.revokeObjectURL(url)
}

export function SettingsView(props: SettingsProps) {
  const [form, setForm] = useState<Settings>(props.settings)
  const [importError, setImportError] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [headersDraft, setHeadersDraft] = useState<Record<number, string>>(
    Object.fromEntries(props.settings.mcpServers.map((s, i) => [i, maskHeadersJson(s.headers)])),
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
    // *** 掩码值自动回填原始密钥；JSON 不完整时不写入（保持原值）
    const merged = mergeMaskedHeaders(form.mcpServers[i]?.headers, draft)
    if (merged.valid) setServer(i, { headers: merged.headers })
  }

  async function fetchModels(): Promise<void> {
    setLoadingModels(true)
    setModelsError('')
    try {
      const list = await listModels(form)
      setModels(list)
      if (!list.length) setModelsError('端点未返回模型列表，可手动填写模型名')
    } catch (e) {
      setModelsError(`获取失败：${e instanceof Error ? e.message : String(e)}（仍可手动填写）`)
    } finally {
      setLoadingModels(false)
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

      <fieldset>
        <legend>配置导入 / 导出</legend>
        <div class="io-row">
          <button class="ghost" onClick={() => exportSettings(form)}>
            导出为 JSON
          </button>
          <label class="ghost import-label">
            导入 JSON
            <input
              type="file"
              accept="application/json,.json"
              style="display:none"
              onChange={(e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (!file) return
                void file.text().then((text) => {
                  const parsed = parseSettings(text)
                  if (parsed) props.onImport(parsed)
                  else setImportError('文件不是有效的配置 JSON（需包含 baseUrl/model 等字段）')
                })
                ;(e.target as HTMLInputElement).value = ''
              }}
            />
          </label>
        </div>
        {importError && <span class="mcp-status error">{importError}</span>}
        <span class="hint">导出文件包含 API Key，仅保存在本机，请勿分享给他人</span>
      </fieldset>

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
        <div class="model-row">
          <input
            type={showKey ? 'text' : 'password'}
            value={form.apiKey}
            onInput={(e) => set('apiKey', (e.target as HTMLInputElement).value)}
          />
          <button
            class="ghost icon-btn"
            title={showKey ? '隐藏密钥' : '显示密钥'}
            onClick={() => setShowKey(!showKey)}
          >
            <IconEye />
          </button>
        </div>
      </label>
      <label>
        模型名
        <div class="model-row">
          <input
            value={form.model}
            onInput={(e) => set('model', (e.target as HTMLInputElement).value)}
            placeholder="claude-sonnet-5"
          />
          <button class="ghost" disabled={loadingModels} onClick={() => void fetchModels()}>
            {loadingModels ? '获取中…' : '获取列表'}
          </button>
        </div>
        {models.length > 0 && (
          <div class="model-chips">
            {models.map((m) => (
              <button class={`chip-btn ${m === form.model ? 'active' : ''}`} key={m} onClick={() => set('model', m)}>
                {m}
              </button>
            ))}
          </div>
        )}
        {modelsError && <span class="mcp-status error">{modelsError}</span>}
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
      <label class="toggle-row">
        <input
          type="checkbox"
          checked={form.contextUseRawHtml}
          onChange={(e) => set('contextUseRawHtml', (e.target as HTMLInputElement).checked)}
        />
        <span>上下文使用完整 HTML 而非提取正文（适合前端调试/页面结构分析；token 消耗大幅上升，超长仍会按截断上限裁剪）</span>
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
                placeholder={'请求头 JSON；敏感值显示为 ***（保持不变），换密钥请填新值'}
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
