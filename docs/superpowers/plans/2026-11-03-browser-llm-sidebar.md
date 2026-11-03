# 浏览器 LLM 侧边栏助手 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 Chrome MV3 扩展：侧边栏内基于当前/选定标签页内容的 LLM 对话 agent，支持 Anthropic 兼容端点、远程 MCP、页面文本与图片读取。

**Architecture:** agent 循环（Anthropic SSE 流式 + 工具分发 + MCP client）全部运行在 Side Panel 扩展页面内，直接调用 `chrome.scripting`/`chrome.tabs` API，无 Service Worker 中转；页面提取通过 `executeScript` 按需注入。规格见 `docs/superpowers/specs/2026-11-03-browser-llm-sidebar-design.md`。

**Tech Stack:** TypeScript + Vite 5 + @crxjs/vite-plugin (beta) + Preact + Vitest（happy-dom 用于 DOM 测试）+ marked/DOMPurify（markdown 渲染与 XSS 防护）

**约定：**
- 所有命令在仓库根目录执行（bash）；每个任务结束必须 `npm test` 全绿再 commit
- 新增依赖在 Task 1 一次性列出：`preact`（UI）、`marked`+`dompurify`（markdown 渲染与净化；替代方案手写 parser 得不偿失）；其余为构建/测试工具
- 代码注释密度：关键决策处一行中文注释，其余自解释

---

### Task 1: 项目脚手架与构建打通

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `manifest.config.ts`
- Create: `src/background/index.ts`, `src/sidepanel/index.html`, `src/sidepanel/main.tsx`, `src/sidepanel/sidepanel.css`

- [ ] **Step 1: 写 package.json 并安装依赖**

```json
{
  "name": "llm-browser-ext",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "dompurify": "^3.1.6",
    "marked": "^14.1.0",
    "preact": "^10.23.0"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.23",
    "@preact/preset-vite": "^2.9.1",
    "@types/chrome": "^0.26.0",
    "happy-dom": "^15.7.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5"
  }
}
```

Run: `npm install`
Expected: 安装成功，无 peer 依赖硬错误（vite 5 与 CRXJS beta.23 兼容）

- [ ] **Step 2: 写 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "vite/client"]
  },
  "include": ["src", "tests", "manifest.config.ts", "vite.config.ts"]
}
```

- [ ] **Step 3: 写 manifest.config.ts（CRXJS defineManifest）**

```ts
import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'LLM Sidebar',
  version: '0.1.0',
  description: '在侧边栏与 LLM 对话，基于当前网页内容回答',
  action: {},
  side_panel: { default_path: 'src/sidepanel/index.html' },
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  permissions: ['sidePanel', 'storage', 'scripting', 'tabs'],
  host_permissions: ['<all_urls>'],
})
```

- [ ] **Step 4: 写 vite.config.ts**

```ts
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

export default defineConfig({
  plugins: [preact(), crx({ manifest })],
})
```

- [ ] **Step 5: 写 background Service Worker（仅注册 side panel 行为）**

`src/background/index.ts`:

```ts
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((e) => console.error('sidePanel 注册失败', e))
```

- [ ] **Step 6: 写 side panel 骨架**

`src/sidepanel/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LLM Sidebar</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`src/sidepanel/main.tsx`:

```tsx
import { render } from 'preact'
import { App } from './App'

render(<App />, document.getElementById('app')!)
```

`src/sidepanel/App.tsx`（占位，后续任务替换）:

```tsx
export function App() {
  return <div style="padding: 12px">LLM Sidebar 加载中…</div>
}
```

`src/sidepanel/sidepanel.css`（基础样式，后续任务扩充）:

```css
:root {
  color-scheme: light dark;
  font-size: 14px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}
#app { display: flex; flex-direction: column; height: 100vh; }
```

- [ ] **Step 7: 构建验证**

Run: `npm run build && npm run check`
Expected: `dist/` 生成，含 `manifest.json`（side_panel/permissions 正确）；tsc 无错误

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: Vite+CRXJS+Preact 脚手架，构建打通"
```

---

### Task 2: 共享类型与文本截断

**Files:**
- Create: `src/shared/types.ts`, `src/shared/truncate.ts`
- Test: `tests/truncate.test.ts`

- [ ] **Step 1: 写失败测试**

`tests/truncate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { truncateText } from '../src/shared/truncate'

describe('truncateText', () => {
  it('未超长时原样返回', () => {
    expect(truncateText('abc', 10)).toEqual({ text: 'abc', truncated: false })
  })
  it('恰好等于上限不截断', () => {
    expect(truncateText('abcd', 4)).toEqual({ text: 'abcd', truncated: false })
  })
  it('超长时截断到上限并标记', () => {
    const r = truncateText('abcdef', 3)
    expect(r).toEqual({ text: 'abc', truncated: true })
  })
  it('上限为 0 返回空串', () => {
    expect(truncateText('abc', 0)).toEqual({ text: '', truncated: true })
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/truncate.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写 src/shared/types.ts（全项目类型定义）**

```ts
// —— Anthropic 消息线格式（子集）——
export interface TextBlock {
  type: 'text'
  text: string
}

export interface ImageBlock {
  type: 'image'
  source: { type: 'base64'; media_type: string; data: string }
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<TextBlock | ImageBlock>
  is_error?: boolean
}

export type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock

export interface WireMessage {
  role: 'user' | 'assistant'
  content: ContentBlock[]
}

// —— 工具系统 ——
export interface ToolParam {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface ToolOutput {
  text: string
  images?: ImageBlock[]
  isError?: boolean
}

export interface ToolContext {
  settings: Settings
  currentTabId?: number
}

export interface ToolDef {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutput>
}

// —— 页面提取 ——
export interface PageImageInfo {
  src: string
  alt: string
  width: number
  height: number
}

export interface PageContent {
  title: string
  url: string
  description: string
  text: string
  images: PageImageInfo[]
}

// —— 配置与会话 ——
export interface McpServerConfig {
  name: string
  url: string
  headers?: Record<string, string>
}

export interface Settings {
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  mcpServers: McpServerConfig[]
  maxPageChars: number
}

export interface SessionState {
  messages: WireMessage[]
  contextTabIds: number[]
}
```

- [ ] **Step 4: 写 src/shared/truncate.ts**

```ts
export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false }
  return { text: text.slice(0, Math.max(0, maxChars)), truncated: true }
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run tests/truncate.test.ts`
Expected: PASS (4)

- [ ] **Step 6: Commit**

```bash
git add src/shared tests/truncate.test.ts
git commit -m "feat: 共享类型定义与文本截断"
```

---

### Task 3: 默认系统提示词与存储层

**Files:**
- Create: `src/shared/defaultPrompt.ts`, `src/shared/storage.ts`, `tests/mocks/chrome.ts`
- Test: `tests/storage.test.ts`

- [ ] **Step 1: 写 src/shared/defaultPrompt.ts（以 Claude Code 官方 agent 提示词风格为底本，适配浏览器场景）**

```ts
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant embedded in a Chrome browser side panel. The user asks questions about web pages they are browsing.

# Tone and style
- Be concise and direct. Answer in the user's language (usually Chinese).
- When answering based on page content, mention which page/tab the information comes from.
- Use markdown formatting for structure.

# Tool use
- You have tools to read page content, take screenshots, fetch page images, list tabs, and read other tabs. MCP tools may also be available.
- If the user asks about the current page and context pages are already provided, answer directly from them.
- If the provided context seems insufficient, call get_page_content to get fresh content, or list_tabs + read_tab to consult other tabs.
- Call at most one independent tool before reassessing; never call tools in a loop without progress.
- When you see an image (screenshot or page image), reason about it directly.

# Constraints
- You can read pages but cannot modify them. Do not claim to have changed any page.
- If a page cannot be read (e.g. chrome:// internal pages), say so and suggest the user open a regular web page.
- If information is not present in the pages or tools, say you don't know. Never fabricate page content.`
```

- [ ] **Step 2: 写 chrome.storage 测试 mock（tests/mocks/chrome.ts，供多个任务复用）**

```ts
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
```

- [ ] **Step 3: 写失败测试 tests/storage.test.ts**

```ts
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
```

- [ ] **Step 4: 运行确认失败**

Run: `npx vitest run tests/storage.test.ts`
Expected: FAIL（storage 模块不存在）

- [ ] **Step 5: 写 src/shared/storage.ts**

```ts
import { DEFAULT_SYSTEM_PROMPT } from './defaultPrompt'
import type { SessionState, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.anthropic.com',
  apiKey: '',
  model: 'claude-sonnet-5',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  mcpServers: [],
  maxPageChars: 50000,
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
```

注意：测试第 2 项中 `DEFAULT_SETTINGS.systemPrompt` 即默认提示词，断言两侧相等成立。

- [ ] **Step 6: 运行确认通过**

Run: `npx vitest run tests/storage.test.ts`
Expected: PASS (3)

- [ ] **Step 7: Commit**

```bash
git add src/shared tests/mocks tests/storage.test.ts
git commit -m "feat: 默认系统提示词与 chrome.storage 封装"
```

---

### Task 4: SSE 解析器

**Files:**
- Create: `src/shared/sse.ts`
- Test: `tests/sse.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { createSseParser } from '../src/shared/sse'

describe('createSseParser', () => {
  it('解析单个完整事件', () => {
    const got: string[] = []
    const feed = createSseParser((d) => got.push(d))
    feed('data: {"a":1}\n\n')
    expect(got).toEqual(['{"a":1}'])
  })

  it('跨 chunk 的事件被正确拼接', () => {
    const got: string[] = []
    const feed = createSseParser((d) => got.push(d))
    feed('data: {"a"')
    feed(':1}\n\ndata: {"b":2}\n\n')
    expect(got).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('忽略注释行与非 data 行', () => {
    const got: string[] = []
    const feed = createSseParser((d) => got.push(d))
    feed(': keepalive\nevent: message\ndata: x\n\n')
    expect(got).toEqual(['x'])
  })

  it('CRLF 行尾兼容', () => {
    const got: string[] = []
    const feed = createSseParser((d) => got.push(d))
    feed('data: y\r\n\r\n')
    expect(got).toEqual(['y'])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/sse.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 src/shared/sse.ts**

```ts
// 逐 chunk 喂入，遇到完整 data: 行时回调（SSE 事件负载字符串）
export function createSseParser(onData: (data: string) => void): (chunk: string) => void {
  let buffer = ''
  return (chunk: string) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data:')) onData(trimmed.slice(5).trim())
    }
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/sse.test.ts`
Expected: PASS (4)

- [ ] **Step 5: Commit**

```bash
git add src/shared/sse.ts tests/sse.test.ts
git commit -m "feat: SSE 流解析器"
```

---

### Task 5: Anthropic 流式客户端

**Files:**
- Create: `src/sidepanel/agent/anthropic.ts`
- Test: `tests/anthropic.test.ts`

- [ ] **Step 1: 写失败测试（消息组装器为纯逻辑，重点覆盖；fetch 层用 stub 验证错误映射）**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createMessageAssembler, streamMessage } from '../src/sidepanel/agent/anthropic'

describe('createMessageAssembler', () => {
  it('组装文本块并回调增量', () => {
    const deltas: string[] = []
    const asm = createMessageAssembler((t) => deltas.push(t))
    for (const ev of [
      { type: 'message_start' },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '你' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '好' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
      { type: 'message_stop' },
    ])
      asm.push(ev)
    const { message, stopReason } = asm.result()
    expect(deltas).toEqual(['你', '好'])
    expect(message).toEqual({ role: 'assistant', content: [{ type: 'text', text: '你好' }] })
    expect(stopReason).toBe('end_turn')
  })

  it('组装 tool_use 块（拼接 partial_json 并解析）', () => {
    const asm = createMessageAssembler()
    for (const ev of [
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 't1', name: 'list_tabs' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"tab' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: 'Id":7}' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' } },
    ])
      asm.push(ev)
    const { message, stopReason } = asm.result()
    expect(message.content[0]).toEqual({ type: 'tool_use', id: 't1', name: 'list_tabs', input: { tabId: 7 } })
    expect(stopReason).toBe('tool_use')
  })

  it('tool_use JSON 不完整时回退为空对象', () => {
    const asm = createMessageAssembler()
    asm.push({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 't2', name: 'x' } })
    asm.push({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{bad' } })
    asm.push({ type: 'content_block_stop', index: 0 })
    const { message } = asm.result()
    expect(message.content[0]).toEqual({ type: 'tool_use', id: 't2', name: 'x', input: {} })
  })
})

describe('streamMessage 错误映射', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('非 2xx 抛 ApiError 且带状态码', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"bad key"}', { status: 401 })))
    await expect(
      streamMessage({ settings: { baseUrl: 'https://x.com', apiKey: 'k', model: 'm' }, system: 's', messages: [] }),
    ).rejects.toThrowError(ApiError)
    try {
      await streamMessage({ settings: { baseUrl: 'https://x.com', apiKey: 'k', model: 'm' }, system: 's', messages: [] })
    } catch (e) {
      expect((e as ApiError).status).toBe(401)
    }
  })

  it('正常流式响应组装完整消息', async () => {
    const sse = 'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n' +
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ok"}}\n\n' +
      'data: {"type":"content_block_stop","index":0}\n\n' +
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })))
    const { message, stopReason } = await streamMessage({
      settings: { baseUrl: 'https://x.com', apiKey: 'k', model: 'm' },
      system: 's',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    expect(message.content).toEqual([{ type: 'text', text: 'ok' }])
    expect(stopReason).toBe('end_turn')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/anthropic.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 src/sidepanel/agent/anthropic.ts**

```ts
import type { ContentBlock, Settings, ToolParam, WireMessage } from '../../shared/types'
import { createSseParser } from '../../shared/sse'

export class ApiError extends Error {
  constructor(
    public status: number,
    body: string,
  ) {
    super(`Anthropic API ${status}: ${body.slice(0, 300)}`)
  }
}

// 把 SSE 事件流组装为完整的 assistant 消息；onTextDelta 用于 UI 流式渲染
export function createMessageAssembler(onTextDelta?: (t: string) => void) {
  const blocks: ContentBlock[] = []
  let curText = ''
  let curTool: { id: string; name: string; json: string } | null = null
  let stopReason = 'end_turn'

  function flush(): void {
    if (curText) {
      blocks.push({ type: 'text', text: curText })
      curText = ''
    }
    if (curTool) {
      let input: unknown
      try {
        input = JSON.parse(curTool.json || '{}')
      } catch {
        input = {}
      }
      blocks.push({ type: 'tool_use', id: curTool.id, name: curTool.name, input })
      curTool = null
    }
  }

  return {
    push(ev: Record<string, any>): void {
      switch (ev.type) {
        case 'content_block_start':
          if (ev.content_block?.type === 'tool_use')
            curTool = { id: ev.content_block.id, name: ev.content_block.name, json: '' }
          break
        case 'content_block_delta':
          if (ev.delta?.type === 'text_delta') {
            curText += ev.delta.text as string
            onTextDelta?.(ev.delta.text as string)
          } else if (ev.delta?.type === 'input_json_delta' && curTool) {
            curTool.json += ev.delta.partial_json as string
          }
          break
        case 'content_block_stop':
          flush()
          break
        case 'message_delta':
          if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason
          break
      }
    },
    result(): { message: WireMessage; stopReason: string } {
      flush()
      return { message: { role: 'assistant', content: blocks }, stopReason }
    },
  }
}

export interface StreamOptions {
  settings: Settings
  system: string
  messages: WireMessage[]
  tools?: ToolParam[]
  signal?: AbortSignal
  onTextDelta?: (t: string) => void
}

export async function streamMessage(opts: StreamOptions): Promise<{ message: WireMessage; stopReason: string }> {
  const base = opts.settings.baseUrl.replace(/\/+$/, '')
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: opts.settings.model,
      max_tokens: 8192,
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools,
      stream: true,
    }),
    signal: opts.signal,
  })
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''))
  if (!res.body) throw new Error('Anthropic 响应无 body')

  const assembler = createMessageAssembler(opts.onTextDelta)
  const feed = createSseParser((data) => {
    if (data === '[DONE]') return
    try {
      assembler.push(JSON.parse(data))
    } catch {
      // 忽略无法解析的行
    }
  })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    feed(decoder.decode(value, { stream: true }))
  }
  return assembler.result()
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/anthropic.test.ts`
Expected: PASS (5)

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/agent/anthropic.ts tests/anthropic.test.ts
git commit -m "feat: Anthropic /v1/messages SSE 流式客户端"
```

---

### Task 6: 上下文组装（纯格式化逻辑）

**Files:**
- Create: `src/sidepanel/agent/context.ts`
- Test: `tests/context.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, formatPageContent } from '../src/sidepanel/agent/context'
import type { PageContent } from '../src/shared/types'

const pc: PageContent = {
  title: '示例页',
  url: 'https://example.com/a',
  description: '描述',
  text: 'A'.repeat(300),
  images: [],
}

describe('formatPageContent', () => {
  it('包含标题/URL/摘要与正文，包裹 page 标签', () => {
    const out = formatPageContent(pc, 10000)
    expect(out).toContain('<page>')
    expect(out).toContain('# 示例页')
    expect(out).toContain('URL: https://example.com/a')
    expect(out).toContain('摘要: 描述')
    expect(out).toContain('A'.repeat(300))
  })
  it('超长截断并标注原始长度', () => {
    const out = formatPageContent(pc, 100)
    expect(out).not.toContain('A'.repeat(300))
    expect(out).toContain('[内容超长，已截断，原文约 300 字符]')
    expect(out.length).toBeLessThan(200)
  })
})

describe('buildSystemPrompt', () => {
  it('无页面时返回原提示词', () => {
    expect(buildSystemPrompt('BASE', [], 1000)).toBe('BASE')
  })
  it('多个页面依次拼接', () => {
    const out = buildSystemPrompt('BASE', [pc, { ...pc, title: '第二页' }], 10000)
    expect(out.startsWith('BASE')).toBe(true)
    expect(out).toContain('# 示例页')
    expect(out).toContain('# 第二页')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/context.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 src/sidepanel/agent/context.ts**

```ts
import { truncateText } from '../../shared/truncate'
import type { PageContent } from '../../shared/types'

// 把页面内容格式化为标注块；超长时截断（扣除头部开销）
export function formatPageContent(pc: PageContent, maxChars: number): string {
  const head = `# ${pc.title}\nURL: ${pc.url}${pc.description ? `\n摘要: ${pc.description}` : ''}\n\n`
  const { text, truncated } = truncateText(pc.text, Math.max(0, maxChars - head.length))
  const tail = truncated ? `\n\n[内容超长，已截断，原文约 ${pc.text.length} 字符]` : ''
  return `<page>\n${head}${text}${tail}\n</page>`
}

export function buildSystemPrompt(base: string, pages: PageContent[], maxChars: number): string {
  if (!pages.length) return base
  const blocks = pages.map((pc) => formatPageContent(pc, maxChars)).join('\n\n')
  return `${base}\n\n# 用户选择的上下文标签页\n\n${blocks}`
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/context.test.ts`
Expected: PASS (4)

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/agent/context.ts tests/context.test.ts
git commit -m "feat: 上下文标签页格式化与系统提示词组装"
```

---

### Task 7: 页面内容提取（注入函数）

**Files:**
- Create: `src/content/extract.ts`
- Test: `tests/extract.test.ts`

- [ ] **Step 1: 写失败测试（happy-dom 环境，文件首行注释指定）**

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { extractPageContent } from '../src/content/extract'

function setupDom(): void {
  document.body.innerHTML = `
    <nav>导航 首页 关于</nav>
    <script>var x = 1</script>
    <main>
      <h1>页面主标题</h1>
      <p>第一段正文，包含 <a href="/x">链接文字</a>。</p>
      <div>
        <h2>小节</h2>
        <p>第二段正文。</p>
        <img src="https://img.example.com/pic.png" alt="示意图" width="800" height="600">
        <img src="https://img.example.com/icon.png" style="display:none" width="16" height="16">
      </div>
    </main>
    <meta name="description" content="页面描述">
  `
  document.title = '测试页'
}

describe('extractPageContent', () => {
  it('提取标题/URL/摘要/正文并保留标题层级', () => {
    setupDom()
    const pc = extractPageContent()!
    expect(pc.title).toBe('测试页')
    expect(pc.url).toBe(location.href)
    expect(pc.description).toBe('页面描述')
    expect(pc.text).toContain('# 页面主标题')
    expect(pc.text).toContain('## 小节')
    expect(pc.text).toContain('第一段正文，包含 链接文字。')
    expect(pc.text).toContain('第二段正文。')
    expect(pc.text).not.toContain('导航')
    expect(pc.text).not.toContain('var x')
  })

  it('收集可见图片信息', () => {
    setupDom()
    const pc = extractPageContent()!
    const srcs = pc.images.map((im) => im.src)
    expect(srcs).toContain('https://img.example.com/pic.png')
    // display:none 的图片仍在 document.images 中，但尺寸信息保留（过滤在取图阶段做）
    expect(pc.images.length).toBe(2)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/extract.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 src/content/extract.ts**

注意：此文件被 `chrome.scripting.executeScript({ func })` 序列化注入，**函数体内不得引用任何运行时 import**（仅允许 `import type`），必须自包含。

```ts
import type { PageContent } from '../shared/types'

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME', 'CANVAS',
  'NAV', 'FOOTER', 'ASIDE', 'FORM', 'BUTTON', 'SELECT', 'OPTION',
])

const BLOCK_TAGS = new Set([
  'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE',
  'FIGCAPTION', 'TD', 'TH', 'DT', 'DD', 'DIV', 'SECTION', 'ARTICLE',
  'MAIN', 'HEADER', 'UL', 'OL', 'TABLE', 'TR', 'DL', 'BODY',
])

function hasBlockChild(el: Element): boolean {
  return Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName))
}

// 提取当前页面结构化内容（在页面上下文中执行）
export function extractPageContent(): PageContent | null {
  const body = document.body
  if (!body) return null
  const out: string[] = []
  const visit = (el: Element): void => {
    for (const child of Array.from(el.children)) {
      if (SKIP_TAGS.has(child.tagName)) continue
      if (getComputedStyle(child).display === 'none') continue
      const heading = /^H([1-6])$/.exec(child.tagName)
      if (heading) {
        const t = child.textContent?.trim()
        if (t) out.push('\n' + '#'.repeat(Number(heading[1])) + ' ' + t)
        continue
      }
      if (hasBlockChild(child)) {
        visit(child)
        continue
      }
      const t = (child as HTMLElement).innerText?.trim() ?? child.textContent?.trim() ?? ''
      if (t) out.push(t)
    }
  }
  visit(body)
  const text = out
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const images = Array.from(document.images)
    .map((img) => ({
      src: img.src,
      alt: img.alt ?? '',
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    }))
    .filter((im) => im.src !== '' && !im.src.startsWith('chrome-extension://'))
  const description = document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ?? ''
  return { title: document.title, url: location.href, description, text, images }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/extract.test.ts`
Expected: PASS (2)

- [ ] **Step 5: Commit**

```bash
git add src/content tests/extract.test.ts
git commit -m "feat: 页面内容提取注入函数"
```

---

### Task 8: 内置工具与分发

**Files:**
- Create: `src/sidepanel/agent/tools/pageContent.ts`, `src/sidepanel/agent/tools/tabs.ts`, `src/sidepanel/agent/tools/screenshot.ts`, `src/sidepanel/agent/tools/images.ts`, `src/sidepanel/agent/tools/registry.ts`
- Test: `tests/tools.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
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
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/tools.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 src/sidepanel/agent/tools/pageContent.ts**

```ts
import { extractPageContent } from '../../../content/extract'
import { formatPageContent } from '../context'
import type { PageContent, ToolContext, ToolDef } from '../../../shared/types'

const UNREADABLE_PREFIXES = [
  'chrome://', 'edge://', 'about:', 'chrome-extension://', 'devtools://',
  'https://chromewebstore.google.com', 'https://chrome.google.com/webstore',
]

// 提取指定标签页（默认当前活动页）内容；内部页面抛错
export async function fetchPageContent(tabId?: number): Promise<PageContent> {
  let id = tabId
  if (id == null) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true })
    id = active?.id
  }
  if (id == null) throw new Error('找不到目标标签页')
  const tab = await chrome.tabs.get(id)
  if (UNREADABLE_PREFIXES.some((p) => tab.url?.startsWith(p)))
    throw new Error(`页面 ${tab.url ?? ''} 不支持内容提取（浏览器内部页面）`)
  const [res] = await chrome.scripting.executeScript({ target: { tabId: id }, func: extractPageContent })
  if (!res?.result) throw new Error('页面内容提取失败（页面可能尚未加载完成）')
  return res.result as PageContent
}

export const pageContentTool: ToolDef = {
  name: 'get_page_content',
  description: '获取指定标签页的结构化正文（标题、URL、摘要、正文）。默认当前活动标签页；先用 list_tabs 查 tabId。',
  inputSchema: {
    type: 'object',
    properties: { tabId: { type: 'number', description: '目标标签页 ID，默认当前标签页' } },
  },
  execute: async (args, ctx: ToolContext) => ({
    text: formatPageContent(await fetchPageContent(args.tabId as number | undefined), ctx.settings.maxPageChars),
  }),
}

export const readTabTool: ToolDef = {
  name: 'read_tab',
  description: '读取指定标签页完整内容并加入当前对话上下文，用于需要参考其他页面时。',
  inputSchema: {
    type: 'object',
    properties: { tabId: { type: 'number', description: '目标标签页 ID（必填）' } },
    required: ['tabId'],
  },
  execute: async (args, ctx) => ({
    text: formatPageContent(await fetchPageContent(args.tabId as number), ctx.settings.maxPageChars),
  }),
}
```

- [ ] **Step 4: 写 src/sidepanel/agent/tools/tabs.ts**

```ts
import type { ToolDef } from '../../../shared/types'

export const listTabsTool: ToolDef = {
  name: 'list_tabs',
  description: '列出浏览器全部标签页（ID、标题、URL、是否活动）。用于在 read_tab / get_page_content 前查找 tabId。',
  inputSchema: { type: 'object', properties: {} },
  execute: async (_args, ctx) => {
    const tabs = await chrome.tabs.query({})
    const lines = tabs.map(
      (t) => `- [${t.id}]${t.active ? '(当前)' : ''} ${t.title ?? ''}\n  ${t.url ?? ''}`,
    )
    const note = ctx.currentTabId != null ? `\n\n侧边栏默认上下文标签页 ID: ${ctx.currentTabId}` : ''
    return { text: `浏览器标签页：\n${lines.join('\n')}${note}` }
  },
}
```

- [ ] **Step 5: 写 src/sidepanel/agent/tools/screenshot.ts**

```ts
import type { ImageBlock, ToolDef } from '../../../shared/types'

function dataUrlToImageBlock(dataUrl: string): ImageBlock {
  const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }
}

export const screenshotTool: ToolDef = {
  name: 'get_screenshot',
  description: '截取当前活动标签页可视区域（JPEG）作为图像输入。适用于查看页面视觉布局、图表，或文本提取不足时。',
  inputSchema: { type: 'object', properties: {} },
  execute: async () => {
    const dataUrl = await chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT as number, {
      format: 'jpeg',
      quality: 70,
    })
    return { text: '已附加当前可视区域截图。', images: [dataUrlToImageBlock(dataUrl)] }
  },
}
```

- [ ] **Step 6: 写 src/sidepanel/agent/tools/images.ts**

```ts
import { fetchPageContent } from './pageContent'
import type { ImageBlock, ToolDef, PageImageInfo } from '../../../shared/types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const SUPPORTED_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function dataUrlToImageBlock(dataUrl: string): ImageBlock | null {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl)
  if (!m) return null
  if (!SUPPORTED_MEDIA.includes(m[1])) return null
  return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }
}

async function urlToDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.blob()
  })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

// 默认取面积最大的 3 张（≥64px），不足时回退前 3 张
function defaultPicks(images: PageImageInfo[]): number[] {
  const big = images
    .map((im, i) => ({ i, area: im.width * im.height }))
    .filter((x) => x.area >= 64 * 64)
    .sort((a, b) => b.area - a.area)
    .slice(0, 3)
    .map((x) => x.i)
    .sort((a, b) => a - b)
  if (big.length) return big
  return [0, 1, 2].filter((i) => i < images.length)
}

export const imagesTool: ToolDef = {
  name: 'get_page_images',
  description:
    '获取指定标签页页面中的图片作为图像输入。默认取面积最大的 3 张大图；可用 index（0 起的序号数组，对应 get_page_content 返回的图片列表）指定。',
  inputSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'number', description: '目标标签页 ID，默认当前标签页' },
      index: { type: 'array', items: { type: 'number' }, description: '图片序号列表，如 [0, 2]' },
    },
  },
  execute: async (args) => {
    const pc = await fetchPageContent(args.tabId as number | undefined)
    const want = Array.isArray(args.index) && args.index.length ? (args.index as number[]) : defaultPicks(pc.images)
    const images: ImageBlock[] = []
    const skipped: string[] = []
    for (const i of want) {
      const info = pc.images[i]
      if (!info) {
        skipped.push(`#${i} 不存在`)
        continue
      }
      if (info.src.startsWith('blob:')) {
        skipped.push(`#${i} blob 图片无法跨上下文获取`)
        continue
      }
      try {
        const dataUrl = info.src.startsWith('data:') ? info.src : await urlToDataUrl(info.src)
        if (dataUrl.length > MAX_IMAGE_BYTES * 1.4) {
          skipped.push(`#${i} 过大`)
          continue
        }
        const block = dataUrlToImageBlock(dataUrl)
        if (block) images.push(block)
        else skipped.push(`#${i} 格式不支持`)
      } catch {
        skipped.push(`#${i} 获取失败`)
      }
    }
    const summary = `页面共 ${pc.images.length} 张图片，已加载 ${images.length} 张。${skipped.length ? `跳过: ${skipped.join('、')}` : ''}`
    return { text: summary, images }
  },
}
```

- [ ] **Step 7: 写 src/sidepanel/agent/tools/registry.ts**

```ts
import type { ToolContext, ToolDef, ToolOutput } from '../../../shared/types'
import { imagesTool } from './images'
import { pageContentTool, readTabTool } from './pageContent'
import { screenshotTool } from './screenshot'
import { listTabsTool } from './tabs'

export function builtinTools(): ToolDef[] {
  return [pageContentTool, screenshotTool, imagesTool, listTabsTool, readTabTool]
}

// 在内置 + MCP 工具列表中查找并执行；未知工具返回错误输出而非抛异常
export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  tools: ToolDef[],
): Promise<ToolOutput> {
  const tool = tools.find((t) => t.name === name)
  if (!tool) return { text: `未知工具: ${name}`, isError: true }
  return tool.execute(args, ctx)
}
```

- [ ] **Step 8: 运行确认通过**

Run: `npx vitest run tests/tools.test.ts`
Expected: PASS (6)

- [ ] **Step 9: Commit**

```bash
git add src/sidepanel/agent/tools tests/tools.test.ts
git commit -m "feat: 内置工具集（页面/截图/图片/标签页）与分发"
```

---

### Task 9: MCP client（streamable HTTP）

**Files:**
- Create: `src/sidepanel/agent/mcp/transport.ts`, `src/sidepanel/agent/mcp/client.ts`
- Test: `tests/mcp.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { McpClient } from '../src/sidepanel/agent/mcp/client'
import { pickResponseForId } from '../src/sidepanel/agent/mcp/transport'

afterEach(() => vi.unstubAllGlobals())

describe('pickResponseForId', () => {
  it('在 SSE 负载中找到对应 id 的 JSON-RPC 响应', () => {
    const payloads = ['{"jsonrpc":"2.0","method":"notifications/progress","params":{}}', '{"jsonrpc":"2.0","id":3,"result":{"tools":[]}}']
    expect(pickResponseForId(payloads, 3)).toEqual({ jsonrpc: '2.0', id: 3, result: { tools: [] } })
  })
  it('找不到时抛错', () => {
    expect(() => pickResponseForId(['{"id":9}'], 3)).toThrow()
  })
})

describe('McpClient', () => {
  function stubFetch(handler: (url: string, init: RequestInit) => Response): void {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init: RequestInit) => handler(String(url), init)))
  }

  it('connect 完成 initialize→tools/list，工具以 mcp__server__ 命名空间暴露', async () => {
    stubFetch((_url, init) => {
      const body = JSON.parse(String(init.body))
      if (body.method === 'initialize')
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-03-26', capabilities: {} } }), {
          status: 200, headers: { 'content-type': 'application/json', 'mcp-session-id': 'sid-1' },
        })
      if (body.method === 'tools/list')
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0', id: body.id,
            result: { tools: [{ name: 'search', description: '搜索', inputSchema: { type: 'object' } }] },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      return new Response(null, { status: 202 })
    })
    const client = new McpClient({ name: 'my srv', url: 'https://mcp.example.com/rpc' })
    await client.connect()
    expect(client.status).toBe('connected')
    expect(client.tools).toHaveLength(1)
    const defs = client.toolDefs()
    expect(defs[0].name).toBe('mcp__my_srv__search')
  })

  it('tools/call 返回文本内容，isError 映射为输出错误', async () => {
    stubFetch((_url, init) => {
      const body = JSON.parse(String(init.body))
      const result =
        body.method === 'initialize' ? { protocolVersion: '2025-03-26', capabilities: {} }
        : body.method === 'tools/list' ? { tools: [{ name: 'search', description: '', inputSchema: {} }] }
        : { content: [{ type: 'text', text: '结果 A' }], isError: false }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    })
    const client = new McpClient({ name: 'srv', url: 'https://mcp.example.com/rpc' })
    await client.connect()
    const out = await client.toolDefs()[0].execute({ q: 'x' }, { settings: { baseUrl: '', apiKey: '', model: '', systemPrompt: '', mcpServers: [], maxPageChars: 50000 } })
    expect(out.text).toBe('结果 A')
    expect(out.isError).toBeFalsy()
  })

  it('连接失败进入 error 状态并抛错', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })))
    const client = new McpClient({ name: 'srv', url: 'https://mcp.example.com/rpc' })
    await expect(client.connect()).rejects.toThrow()
    expect(client.status).toBe('error')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/mcp.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 src/sidepanel/agent/mcp/transport.ts**

```ts
import { createSseParser } from '../../../shared/sse'

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: number
  result?: unknown
  error?: { code: number; message: string }
}

// 在 SSE 负载集合中找出指定 id 的 JSON-RPC 响应（纯函数，便于测试）
export function pickResponseForId(payloads: string[], id: number): JsonRpcResponse {
  for (const p of payloads) {
    try {
      const j = JSON.parse(p)
      if (j && j.id === id && (j.result !== undefined || j.error !== undefined)) return j
    } catch {
      // 跳过非 JSON 负载（如通知）
    }
  }
  throw new Error(`MCP SSE 流中未找到 id=${id} 的响应`)
}

// MCP streamable HTTP transport：POST JSON-RPC，响应为 JSON 或 SSE
export class McpHttpTransport {
  private static nextId = 0
  sessionId?: string

  constructor(
    private url: string,
    private extraHeaders: Record<string, string> = {},
  ) {}

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(this.sessionId ? { 'mcp-session-id': this.sessionId } : {}),
      ...this.extraHeaders,
    }
  }

  async request(method: string, params?: unknown): Promise<any> {
    const id = ++McpHttpTransport.nextId
    const res = await fetch(this.url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    })
    if (!res.ok) throw new Error(`MCP ${method} HTTP ${res.status}`)
    const sid = res.headers.get('mcp-session-id')
    if (sid) this.sessionId = sid
    if (res.status === 202) return null
    const ct = res.headers.get('content-type') ?? ''
    const body: JsonRpcResponse = ct.includes('text/event-stream')
      ? await this.readSseBody(res, id)
      : await res.json()
    if (body.error) throw new Error(`MCP ${method}: ${body.error.message}`)
    return body.result
  }

  async notify(method: string, params?: unknown): Promise<void> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ jsonrpc: '2.0', method, params }),
    })
    if (!res.ok && res.status !== 202) throw new Error(`MCP ${method} HTTP ${res.status}`)
  }

  private async readSseBody(res: Response, id: number): Promise<JsonRpcResponse> {
    const payloads: string[] = []
    const feed = createSseParser((d) => payloads.push(d))
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      feed(decoder.decode(value, { stream: true }))
    }
    return pickResponseForId(payloads, id)
  }
}
```

- [ ] **Step 4: 写 src/sidepanel/agent/mcp/client.ts**

```ts
import type { McpServerConfig, ToolDef } from '../../../shared/types'
import { McpHttpTransport } from './transport'

export interface McpToolInfo {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

function sanitizeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export class McpClient {
  private transport: McpHttpTransport
  tools: McpToolInfo[] = []
  status: 'idle' | 'connected' | 'error' = 'idle'
  lastError = ''

  constructor(public cfg: McpServerConfig) {
    this.transport = new McpHttpTransport(cfg.url, cfg.headers)
  }

  async connect(): Promise<void> {
    this.status = 'idle'
    try {
      await this.transport.request('initialize', {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'llm-browser-ext', version: '0.1.0' },
      })
      await this.transport.notify('notifications/initialized')
      const list = await this.transport.request('tools/list', {})
      const tools = (list?.tools ?? []) as Array<Record<string, any>>
      this.tools = tools.map((t) => ({
        name: String(t.name),
        description: String(t.description ?? ''),
        inputSchema: t.inputSchema ?? { type: 'object' },
      }))
      this.status = 'connected'
    } catch (e) {
      this.status = 'error'
      this.lastError = e instanceof Error ? e.message : String(e)
      throw e
    }
  }

  toolDefs(): ToolDef[] {
    const prefix = `mcp__${sanitizeName(this.cfg.name)}__`
    return this.tools.map((t) => ({
      name: prefix + t.name,
      description: t.description || `MCP 工具 ${t.name}`,
      inputSchema: t.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        const result = await this.transport.request('tools/call', { name: t.name, arguments: args })
        const content = (result?.content ?? []) as Array<{ type: string; text?: string }>
        const text = content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
        return { text: text || JSON.stringify(result), isError: Boolean(result?.isError) }
      },
    }))
  }
}
```

- [ ] **Step 5: 运行确认通过**

Run: `npx vitest run tests/mcp.test.ts`
Expected: PASS (5)

- [ ] **Step 6: Commit**

```bash
git add src/sidepanel/agent/mcp tests/mcp.test.ts
git commit -m "feat: MCP streamable HTTP client 与工具桥接"
```

---

### Task 10: Agent 主循环

**Files:**
- Create: `src/sidepanel/agent/loop.ts`
- Test: `tests/loop.test.ts`

- [ ] **Step 1: 写失败测试（用假 streamFn 与假工具，覆盖：工具轮转 / 错误回传 / hop 上限）**

```ts
import { describe, expect, it, vi } from 'vitest'
import { runAgentLoop } from '../src/sidepanel/agent/loop'
import type { ToolDef, WireMessage } from '../src/shared/types'

const settings = { baseUrl: '', apiKey: '', model: '', systemPrompt: '', mcpServers: [], maxPageChars: 50000 }

function textMsg(role: 'user' | 'assistant', text: string): WireMessage {
  return { role, content: [{ type: 'text', text }] }
}

describe('runAgentLoop', () => {
  it('无工具调用时单轮返回', async () => {
    const streamFn = vi.fn(async () => ({
      message: { role: 'assistant', content: [{ type: 'text', text: '答' }] },
      stopReason: 'end_turn',
    }))
    const out = await runAgentLoop({
      settings, system: 's', history: [textMsg('user', '问')], tools: [], ctx: { settings },
      streamFn: streamFn as any,
    })
    expect(out).toHaveLength(2)
    expect(streamFn).toHaveBeenCalledTimes(1)
  })

  it('工具调用后回传 tool_result 并再请求一轮', async () => {
    let round = 0
    const streamFn = vi.fn(async () => {
      round += 1
      if (round === 1)
        return {
          message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'list_tabs', input: {} }] },
          stopReason: 'tool_use',
        }
      return { message: { role: 'assistant', content: [{ type: 'text', text: '完成' }] }, stopReason: 'end_turn' }
    })
    const echoTool: ToolDef = {
      name: 'list_tabs', description: '', inputSchema: {},
      execute: async () => ({ text: '两个标签页' }),
    }
    const out = await runAgentLoop({
      settings, system: 's', history: [textMsg('user', '问')], tools: [echoTool], ctx: { settings },
      streamFn: streamFn as any,
    })
    expect(streamFn).toHaveBeenCalledTimes(2)
    const toolResultMsg = out[2]
    expect(toolResultMsg.role).toBe('user')
    expect(toolResultMsg.content[0]).toEqual({
      type: 'tool_result', tool_use_id: 't1', content: '两个标签页',
    })
    expect(out.at(-1)!.content[0]).toEqual({ type: 'text', text: '完成' })
  })

  it('工具抛异常时以 is_error 回传不中断', async () => {
    let round = 0
    const streamFn = vi.fn(async () => {
      round += 1
      if (round === 1)
        return {
          message: { role: 'assistant', content: [{ type: 'tool_use', id: 't9', name: 'boom', input: {} }] },
          stopReason: 'tool_use',
        }
      return { message: { role: 'assistant', content: [{ type: 'text', text: '知道了' }] }, stopReason: 'end_turn' }
    })
    const boom: ToolDef = {
      name: 'boom', description: '', inputSchema: {},
      execute: async () => {
        throw new Error('炸了')
      },
    }
    const out = await runAgentLoop({
      settings, system: 's', history: [textMsg('user', '问')], tools: [boom], ctx: { settings },
      streamFn: streamFn as any,
    })
    const tr = out[2].content[0] as Record<string, unknown>
    expect(tr['type']).toBe('tool_result')
    expect(tr['is_error']).toBe(true)
    expect(String(tr['content'])).toContain('炸了')
  })

  it('达到 hop 上限时停止', async () => {
    const streamFn = vi.fn(async () => ({
      message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'loop', input: {} }] },
      stopReason: 'tool_use',
    }))
    const loopTool: ToolDef = {
      name: 'loop', description: '', inputSchema: {}, execute: async () => ({ text: 'x' }),
    }
    const out = await runAgentLoop({
      settings, system: 's', history: [textMsg('user', '问')], tools: [loopTool], ctx: { settings },
      streamFn: streamFn as any,
    })
    expect(streamFn.mock.calls.length).toBeLessThanOrEqual(21)
    expect(out.length).toBeGreaterThan(2)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/loop.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 src/sidepanel/agent/loop.ts**

```ts
import type {
  ContentBlock, Settings, TextBlock, ToolContext, ToolDef, ToolParam, ToolUseBlock, ToolOutput, WireMessage,
} from '../../shared/types'
import { streamMessage } from './anthropic'
import { dispatchTool } from './tools/registry'

export const MAX_TOOL_HOPS = 20

export interface LoopCallbacks {
  textDelta?: (t: string) => void
  assistant?: (m: WireMessage) => void
  toolCall?: (name: string, input: unknown) => void
  toolResult?: (name: string, output: ToolOutput) => void
}

export interface LoopDeps {
  settings: Settings
  system: string
  history: WireMessage[]
  tools: ToolDef[]
  ctx: ToolContext
  signal?: AbortSignal
  streamFn?: typeof streamMessage
  on: LoopCallbacks
}

// 主循环：流式请求 → 若有 tool_use 则执行并回传 → 重复直到 end_turn 或达上限
export async function runAgentLoop(deps: LoopDeps): Promise<WireMessage[]> {
  const streamFn = deps.streamFn ?? streamMessage
  const messages = [...deps.history]
  const toolParams: ToolParam[] = deps.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }))
  for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
    const { message, stopReason } = await streamFn({
      settings: deps.settings,
      system: deps.system,
      messages,
      tools: toolParams.length ? toolParams : undefined,
      signal: deps.signal,
      onTextDelta: deps.on.textDelta,
    })
    messages.push(message)
    deps.on.assistant?.(message)
    const calls = message.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
    if (stopReason !== 'tool_use' || calls.length === 0) break
    const results: ContentBlock[] = []
    for (const call of calls) {
      deps.on.toolCall?.(call.name, call.input)
      let output: ToolOutput
      try {
        output = await dispatchTool(call.name, (call.input ?? {}) as Record<string, unknown>, deps.ctx, deps.tools)
      } catch (e) {
        output = { text: e instanceof Error ? e.message : String(e), isError: true }
      }
      deps.on.toolResult?.(call.name, output)
      const content = output.images?.length
        ? ([{ type: 'text', text: output.text } as TextBlock, ...output.images])
        : output.text
      results.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content,
        is_error: output.isError ? true : undefined,
      })
    }
    messages.push({ role: 'user', content: results })
  }
  return messages
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/loop.test.ts`
Expected: PASS (4)

- [ ] **Step 5: Commit**

```bash
git add src/sidepanel/agent/loop.ts tests/loop.test.ts
git commit -m "feat: agent 主循环（流式+工具轮转）"
```

---

### Task 11: 聊天 UI（Markdown / ToolTrace / Chat）

**Files:**
- Create: `src/sidepanel/components/Markdown.ts`, `src/sidepanel/components/ToolTrace.tsx`, `src/sidepanel/components/Chat.tsx`
- Test: `tests/markdown.test.ts`

- [ ] **Step 1: 写失败测试（markdown 净化）**

```ts
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src/sidepanel/components/Markdown'

describe('renderMarkdown', () => {
  it('渲染基本 markdown', () => {
    const html = renderMarkdown('**加粗** 与 `code`')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<code>code</code>')
  })
  it('移除 script 标签防 XSS', () => {
    const html = renderMarkdown('hi <script>alert(1)</script><img src=x onerror=alert(2)>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/markdown.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 src/sidepanel/components/Markdown.ts**

```ts
import DOMPurify from 'dompurify'
import { marked } from 'marked'

// markdown → 净化后的 HTML（模型输出不可信，必须过 DOMPurify）
export function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(raw)
}
```

- [ ] **Step 4: 写 src/sidepanel/components/ToolTrace.tsx**

```tsx
import type { ToolOutput } from '../../shared/types'

export interface TraceEntry {
  id: string
  name: string
  input: unknown
  output?: ToolOutput
}

export function ToolTrace({ entry }: { entry: TraceEntry }) {
  const status = entry.output ? (entry.output.isError ? '✗' : '✓') : '…'
  return (
    <details class="trace">
      <summary>
        🔧 {entry.name} {status}
      </summary>
      <pre class="trace-input">{JSON.stringify(entry.input, null, 2)}</pre>
      {entry.output && <pre class="trace-output">{entry.output.text.slice(0, 2000)}</pre>}
    </details>
  )
}
```

- [ ] **Step 5: 写 src/sidepanel/components/Chat.tsx**

```tsx
import { useEffect, useRef } from 'preact/hooks'
import type { ToolOutput, ToolResultBlock, WireMessage } from '../../shared/types'
import { renderMarkdown } from './Markdown'
import { ToolTrace, type TraceEntry } from './ToolTrace'

export interface ChatProps {
  messages: WireMessage[]
  streamingText: string
  running: boolean
  error: string
  onSend: (text: string) => void
  onStop: () => void
  onRetry: () => void
  onClear: () => void
}

export function Chat(props: ChatProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [props.messages.length, props.streamingText])

  // 从消息序列构造视图项：文本气泡 + 工具轨迹
  const toolResults = new Map<string, ToolResultBlock>()
  for (const m of props.messages)
    for (const b of m.content)
      if (b.type === 'tool_result') toolResults.set(b.tool_use_id, b)

  const items: Array<{ kind: 'user' | 'assistant' | 'trace'; text?: string; entry?: TraceEntry }> = []
  for (const m of props.messages) {
    for (const b of m.content) {
      if (b.type === 'text' && b.text.trim())
        items.push({ kind: m.role === 'user' ? 'user' : 'assistant', text: b.text })
      else if (b.type === 'tool_use') {
        const entry: TraceEntry = {
          id: b.id, name: b.name, input: b.input,
          output: toolResults.get(b.id)
            ? ({
                text: typeof toolResults.get(b.id)!.content === 'string'
                  ? String(toolResults.get(b.id)!.content)
                  : '[含图片的结果]',
                isError: toolResults.get(b.id)!.is_error,
              } as ToolOutput)
            : undefined,
        }
        items.push({ kind: 'trace', entry })
      }
    }
  }

  function send(): void {
    const text = inputRef.current?.value.trim()
    if (!text || props.running) return
    if (inputRef.current) inputRef.current.value = ''
    props.onSend(text)
  }

  return (
    <div class="chat">
      <div class="msg-list" ref={listRef}>
        {items.length === 0 && !props.streamingText && <div class="empty">向 AI 提问当前网页内容…</div>}
        {items.map((it, i) =>
          it.kind === 'trace' ? (
            <ToolTrace key={`t${i}`} entry={it.entry!} />
          ) : (
            <div key={i} class={`bubble ${it.kind}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(it.text!) }} />
          ),
        )}
        {props.streamingText && (
          <div class="bubble assistant" dangerouslySetInnerHTML={{ __html: renderMarkdown(props.streamingText) }} />
        )}
        {props.error && (
          <div class="error-card">
            <div>{props.error}</div>
            <button onClick={() => props.onRetry()}>重试</button>
          </div>
        )}
      </div>
      <div class="input-row">
        <textarea
          ref={inputRef}
          placeholder="询问当前网页…（Enter 发送，Shift+Enter 换行）"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        {props.running ? <button class="stop" onClick={() => props.onStop()}>停止</button> : <button onClick={() => send()}>发送</button>}
        <button class="ghost" title="清空会话" onClick={() => props.onClear()}>🗑</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 运行测试与类型检查**

Run: `npx vitest run tests/markdown.test.ts && npm run check`
Expected: PASS (2)；tsc 无错误

- [ ] **Step 7: Commit**

```bash
git add src/sidepanel/components tests/markdown.test.ts
git commit -m "feat: 聊天 UI（markdown 渲染/工具轨迹/流式气泡）"
```

---

### Task 12: TabPicker、Settings 与 App 集成

**Files:**
- Create: `src/sidepanel/components/TabPicker.tsx`, `src/sidepanel/components/Settings.tsx`, `src/sidepanel/components/lastUser.ts`
- Modify: `src/sidepanel/App.tsx`（替换占位）、`src/sidepanel/sidepanel.css`（追加样式）
- Test: `tests/lastUser.test.ts`

- [ ] **Step 1: 写失败测试 tests/lastUser.test.ts（重试所需的纯逻辑）**

```ts
import { describe, expect, it } from 'vitest'
import { lastUserQuery } from '../src/sidepanel/components/lastUser'

describe('lastUserQuery', () => {
  it('找到最后一条含文本的用户消息与其截断点', () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: '第一问' }] },
      { role: 'assistant', content: [{ type: 'text', text: '答' }] },
      { role: 'user', content: [{ type: 'text', text: '第二问' }] },
      { role: 'assistant', content: [{ type: 'text', text: '答2' }] },
    ] as any
    expect(lastUserQuery(messages)).toEqual({ text: '第二问', cutoff: 2 })
  })
  it('没有用户文本消息时返回 null', () => {
    const messages = [{ role: 'assistant', content: [{ type: 'text', text: 'hi' }] }] as any
    expect(lastUserQuery(messages)).toBeNull()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/lastUser.test.ts`
Expected: FAIL

- [ ] **Step 3: 写 src/sidepanel/components/lastUser.ts**

```ts
import type { WireMessage } from '../../shared/types'

// 供「重试」使用：定位最后一条用户文本消息与其在数组中的截断下标
export function lastUserQuery(messages: WireMessage[]): { text: string; cutoff: number } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const text = m.content.find((b) => b.type === 'text')?.text
    if (text) return { text, cutoff: i }
  }
  return null
}
```

- [ ] **Step 4: 写 src/sidepanel/components/TabPicker.tsx**

```tsx
export interface PickerTab {
  id: number
  title: string
  url: string
}

export interface TabPickerProps {
  tabs: PickerTab[]
  selected: number[]
  onToggle: (id: number) => void
}

export function TabPicker(props: TabPickerProps) {
  const byId = new Map(props.tabs.map((t) => [t.id, t]))
  const chips = props.selected.filter((id) => byId.has(id))
  return (
    <details class="tab-picker">
      <summary>
        📑 上下文（{chips.length}）
        {chips.map((id) => (
          <span class="chip" title={byId.get(id)!.url}>
            {byId.get(id)!.title.slice(0, 12)}
          </span>
        ))}
      </summary>
      <div class="tab-list">
        {props.tabs.map((t) => (
          <label key={t.id}>
            <input
              type="checkbox"
              checked={props.selected.includes(t.id)}
              onChange={() => props.onToggle(t.id)}
            />
            <span class="tab-title" title={t.url}>
              {t.title || t.url}
            </span>
          </label>
        ))}
      </div>
    </details>
  )
}
```

- [ ] **Step 5: 写 src/sidepanel/components/Settings.tsx**

```tsx
import { useState } from 'preact/hooks'
import { DEFAULT_SYSTEM_PROMPT } from '../../shared/defaultPrompt'
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
        <button class="ghost" onClick={() => props.onBack()}>
          ← 返回
        </button>
        <button onClick={() => props.onSave(form)}>保存</button>
      </div>

      <label>
        API Base URL
        <input value={form.baseUrl} onInput={(e) => set('baseUrl', (e.target as HTMLInputElement).value)} placeholder="https://api.anthropic.com" />
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
        <input type="number" value={form.maxPageChars} onInput={(e) => set('maxPageChars', Number((e.target as HTMLInputElement).value) || 50000)} />
      </label>
      <label>
        系统提示词
        <div class="prompt-row">
          <button class="ghost" onClick={() => set('systemPrompt', DEFAULT_SYSTEM_PROMPT)}>
            恢复默认
          </button>
        </div>
        <textarea rows="10" value={form.systemPrompt} onInput={(e) => set('systemPrompt', (e.target as HTMLTextAreaElement).value)} />
      </label>

      <fieldset>
        <legend>MCP Servers（streamable HTTP）</legend>
        {form.mcpServers.map((srv, i) => {
          const st = props.mcpStatuses.find((s) => s.name === srv.name)
          return (
            <div class="mcp-row" key={i}>
              <input value={srv.name} placeholder="名称" onInput={(e) => setServer(i, { name: (e.target as HTMLInputElement).value })} />
              <input value={srv.url} placeholder="https://…（JSON-RPC 端点）" onInput={(e) => setServer(i, { url: (e.target as HTMLInputElement).value })} />
              <textarea rows="2" value={headersDraft[i] ?? '{}'} onInput={(e) => saveServerHeaders(i, (e.target as HTMLTextAreaElement).value)} placeholder='请求头 JSON，如 {"Authorization":"Bearer …"}' />
              <span class={`mcp-status ${st?.status ?? 'idle'}`}>
                {st?.status === 'connected' ? `已连接（${st.toolCount} 工具）` : st?.status === 'error' ? `离线: ${st.error.slice(0, 60)}` : '未连接'}
              </span>
              <button class="ghost" onClick={() => setForm({ ...form, mcpServers: form.mcpServers.filter((_, j) => j !== i) })}>
                删除
              </button>
            </div>
          )
        })}
        <button class="ghost" onClick={() => setForm({ ...form, mcpServers: [...form.mcpServers, { name: `server-${form.mcpServers.length + 1}`, url: '' }] })}>
          + 添加 MCP Server
        </button>
      </fieldset>
    </div>
  )
}
```

- [ ] **Step 6: 替换 src/sidepanel/App.tsx 为完整应用**

```tsx
import { useEffect, useRef, useState } from 'preact/hooks'
import { buildSystemPrompt } from './agent/context'
import { runAgentLoop } from './agent/loop'
import { McpClient } from './agent/mcp/client'
import { fetchPageContent } from './agent/tools/pageContent'
import { builtinTools } from './agent/tools/registry'
import { Chat } from './components/Chat'
import { lastUserQuery } from './components/lastUser'
import { SettingsView, type McpStatus } from './components/Settings'
import { TabPicker, type PickerTab } from './components/TabPicker'
import { clearSession, getSession, getSettings, saveSession, saveSettings } from '../../shared/storage'
import type { SessionState, Settings } from '../../shared/types'

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
    const history = [...session.messages, { role: 'user' as const, content: [{ type: 'text' as const, text }] }]
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
        <button class="ghost" onClick={() => setView(view === 'chat' ? 'settings' : 'chat')}>
          ⚙
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
        <SettingsView settings={settings} mcpStatuses={mcpStatuses} onSave={(s) => void saveAndReconnect(s)} onBack={() => setView('chat')} />
      )}
    </div>
  )
}
```

注：`acc` 累积每条已完成消息并即时进 state（多轮工具调用时用户能实时看到 assistant 文本与工具轨迹）；成功时以 `returned`（与 acc 等价）持久化，失败/中断时以 acc 持久化，流式中的未完成文本不保留。

- [ ] **Step 7: 追加 sidepanel.css 样式**

```css
.app { display: flex; flex-direction: column; height: 100vh; }
.topbar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(128, 128, 128, 0.3); }
.spacer { flex: 1; }
.model-tag { font-size: 12px; opacity: 0.7; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ghost { background: none; border: none; cursor: pointer; font-size: 15px; opacity: 0.75; }
.ghost:hover { opacity: 1; }

.tab-picker { position: relative; }
.tab-picker summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.chip { background: rgba(128, 128, 128, 0.2); border-radius: 8px; padding: 1px 7px; font-size: 11px; max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tab-list { position: absolute; z-index: 10; top: 100%; left: 0; width: 300px; max-height: 260px; overflow: auto; background: var(--bg, #fff); border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 8px; padding: 6px; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25); }
.tab-list label { display: flex; gap: 6px; padding: 3px 2px; align-items: center; }
.tab-title { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.chat { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.msg-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.empty { opacity: 0.55; text-align: center; margin-top: 40px; }
.bubble { max-width: 92%; padding: 8px 10px; border-radius: 10px; line-height: 1.5; overflow-wrap: break-word; }
.bubble pre { overflow-x: auto; }
.bubble.user { align-self: flex-end; background: #2563eb; color: #fff; }
.bubble.assistant { align-self: flex-start; background: rgba(128, 128, 128, 0.14); }
.trace { align-self: stretch; font-size: 12px; opacity: 0.85; }
.trace summary { cursor: pointer; }
.trace pre { background: rgba(128, 128, 128, 0.12); padding: 6px; border-radius: 6px; overflow-x: auto; max-height: 200px; }
.error-card { align-self: stretch; border: 1px solid #dc2626; color: #dc2626; border-radius: 8px; padding: 8px; font-size: 12px; display: flex; flex-direction: column; gap: 6px; }

.input-row { display: flex; gap: 6px; padding: 8px; border-top: 1px solid rgba(128, 128, 128, 0.3); }
.input-row textarea { flex: 1; resize: none; height: 60px; padding: 8px; border-radius: 8px; border: 1px solid rgba(128, 128, 128, 0.4); font: inherit; background: transparent; color: inherit; }
.input-row button { border: none; border-radius: 8px; padding: 0 14px; background: #2563eb; color: #fff; cursor: pointer; }
.input-row button.stop { background: #dc2626; }

.settings { padding: 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
.settings-head { display: flex; justify-content: space-between; }
.settings label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.settings input, .settings textarea { padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(128, 128, 128, 0.4); font: inherit; background: transparent; color: inherit; }
.settings fieldset { border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 8px; }
.mcp-row { display: flex; flex-direction: column; gap: 4px; padding: 8px; border-bottom: 1px dashed rgba(128, 128, 128, 0.3); }
.mcp-status.connected { color: #16a34a; }
.mcp-status.error { color: #dc2626; }
```

- [ ] **Step 8: 全量测试与构建**

Run: `npm test && npm run check && npm run build`
Expected: 全部测试 PASS；tsc 无错误；构建产出 `dist/`

- [ ] **Step 9: Commit**

```bash
git add src/sidepanel tests/lastUser.test.ts
git commit -m "feat: TabPicker/Settings/App 集成，端到端链路打通"
```

---

### Task 13: 构建产物加载验证与手动 E2E 清单

**Files:**
- Create: `README.md`

- [ ] **Step 1: 确认构建产物 manifest 正确**

Run: `npm run build && cat dist/manifest.json`
Expected: 包含 `"side_panel"`、`"permissions"` 含 sidePanel/storage/scripting/tabs、`host_permissions` 含 `<all_urls>`

- [ ] **Step 2: 手动加载与 E2E（需人工在 Chrome 中执行，逐项勾选）**

1. `chrome://extensions` → 开发者模式 → 「加载已解压的扩展程序」→ 选 `dist/` 目录
2. 点击扩展图标打开侧边栏 → 设置 baseUrl/apiKey/model → 保存 → 无报错
3. 打开任一普通网页 → 问「这个页面讲了什么」→ 回答引用页面实际内容（验证提取+注入）
4. 问「页面上有哪些图片」或要求看图表 → agent 调用 get_screenshot / get_page_images，vision 模型能描述图片
5. TabPicker 勾选另一个标签页 → 提问同时对比两页内容；再让 agent「用 list_tabs 看看还开了哪些页，读一下其中某页」（验证 read_tab）
6. 设置里添加一个 streamable HTTP MCP server（如远程文件系统/搜索 demo）→ 状态显示已连接与工具数 → 对话中调用 MCP 工具
7. 断网或填错 key → 发送后出现错误卡片 → 修复后点「重试」恢复
8. 访问 `chrome://settings` 提问 → 明确提示内部页面不可提取
9. 重启浏览器 → 重开面板 → 历史消息仍在；清空会话按钮有效

- [ ] **Step 3: 写 README.md**

```markdown
# LLM Sidebar（浏览器 LLM 侧边栏助手）

Chrome MV3 扩展：在侧边栏与 LLM 对话，基于当前/选定标签页内容回答。支持 Anthropic 兼容端点、远程 MCP（streamable HTTP）、页面文本/截图/图片读取。

## 开发

​```bash
npm install
npm test          # Vitest 单测
npm run build     # 产出 dist/
​```

`chrome://extensions` → 开发者模式 → 加载已解压 → 选择 `dist/`。

## 使用

1. 侧边栏 ⚙ 设置 API Base URL / Key / 模型名（任意 Anthropic 兼容端点，如 GLM 的 anthropic 兼容端点）
2. 顶部 📑 勾选作为上下文的标签页（默认当前页）
3. 直接提问；agent 可调用内置工具（读页面/截图/取图/列标签页/读其他标签页）与已配置的 MCP 工具

设计文档：`docs/superpowers/specs/2026-11-03-browser-llm-sidebar-design.md`
```

（注意：README 中代码围栏写时用真实三反引号，上述 `​`` `​ 为零宽占位避免嵌套冲突，实际写入时替换。）

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README 与加载/验收说明"
```

---

## Self-Review 记录（写计划时已检查）

- 规格覆盖：协议(T5)、MCP(T9)、文本提取(T7)、图片(T8)、上下文管理(T6/T12)、设置(T3/T12)、错误处理(T5/T8/T10/T12)、测试策略(各任务+T13 清单) — 全覆盖
- 类型一致性：ToolOutput/ToolDef/ToolParam 定义于 T2，T8/T9/T10 使用一致；fetchPageContent 在 T8 定义、T12 引用；McpClient.connect/status/tools 在 T9 定义、T12 引用
- 无占位符：所有代码块完整可写盘（T3 Step3 测试文件首行的错误示意行已删除，以标注说明）
