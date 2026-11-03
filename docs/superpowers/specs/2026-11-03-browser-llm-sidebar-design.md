# 浏览器 LLM 侧边栏助手 — 设计文档

日期：2026-11-03
状态：已获用户认可

## 1. 概述

一个 Chrome 扩展（Manifest V3）：在浏览器侧边栏中提供针对当前网页内容的对话问答。用户可以向 LLM 询问当前页面（或其他标签页）的内容，agent 能读取页面文本与图片，并可自主拉取更多标签页进入上下文。支持配置任意 Anthropic 兼容端点与远程 MCP server。

## 2. 需求决策记录

| 决策点 | 结论 |
|---|---|
| API 协议 | 仅 Anthropic `/v1/messages`（baseUrl/model/apiKey 可配，可指向任何 Anthropic 兼容端点） |
| MCP | 仅远程 streamable-HTTP/SSE server，扩展页面直接 fetch；不支持 stdio |
| 页面读取 | content script 提取结构化文本；图片按需获取（截图 + 抓取 img base64），不默认发图 |
| 上下文管理 | 管理「哪些标签页进入 agent 上下文」：UI 勾选 + agent 工具两条路径，默认当前标签页；**不修改页面 DOM** |
| 技术栈 | TypeScript + Vite + CRXJS + Preact |
| 会话 | 单会话，chrome.storage 持久化，重启恢复，可一键清空 |
| agent 循环位置 | Side Panel 页面内（面板关闭则中断，与 Claude Code 关终端一致） |

### 非目标（v1 明确不做）

- stdio MCP / native messaging host
- 修改、插入网页 DOM 内容
- 多会话历史列表
- OpenAI 协议兼容
- Playwright 等自动化 E2E

## 3. 总体架构

```
┌─────────────────────────────────────┐
│ Side Panel (Preact + TS)            │
│  ├─ 聊天 UI（markdown 渲染/流式输出）│
│  ├─ 标签页上下文选择器 (chips)       │
│  ├─ 设置页（API/系统提示词/MCP）     │
│  └─ Agent 运行时                     │
│     ├─ agent loop（SSE 流式）        │
│     ├─ Anthropic client (/v1/messages)│
│     ├─ 内置工具注册表                │
│     └─ MCP client (streamable HTTP)  │
└──────┬──────────────┬───────────────┘
       │ 直接调用      │ fetch（host_permissions
       ▼              ▼ 豁免 CORS）
chrome.scripting   Anthropic API / 远程 MCP
chrome.tabs.*
       │
       ▼ 按需注入
Content Script（提取页面文本/图片信息）

Service Worker：极薄，仅注册 side panel 行为
```

关键点：

- Side panel 是扩展页面，可直接调用 `chrome.scripting` / `chrome.tabs` / `chrome.tabs.captureVisibleTab`，且 fetch 受 host_permissions 豁免 CORS，因此 agent 运行时无需 Service Worker 中转。
- Service Worker 仅调用 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`。
- 页面内容提取通过 `chrome.scripting.executeScript` 注入函数按需执行，无常驻 content script。

### Manifest 权限

- `permissions`: `sidePanel`, `storage`, `scripting`, `tabs`
- `host_permissions`: `<all_urls>`（读任意页面、跨域 fetch API 与 MCP、抓取页面图片）

## 4. 组件设计

### 4.1 Side Panel UI（`src/sidepanel/components/`）

- **Chat**：消息列表（用户/助手/工具调用轨迹），markdown 渲染，流式增量渲染；错误卡片带重试按钮
- **TabPicker**：面板顶部 chips 展示已选上下文标签页；点 `+` 弹出全部标签页勾选列表（title + url + favicon）
- **Settings**：baseUrl / apiKey / model / 系统提示词（多行文本，带恢复默认按钮）/ MCP server 列表（增删、连接状态、发现工具数）/ 单页截断长度
- **ToolTrace**：可折叠的工具调用过程展示（工具名、参数摘要、结果状态）

### 4.2 Agent 运行时（`src/sidepanel/agent/`）

- **loop.ts**：主循环。流程：组装上下文（系统提示词 + 选中标签页内容）→ 调 Anthropic（SSE 流式）→ 若返回 `tool_use` 则执行工具、以 `tool_result` 回传并继续循环 → 直至 `end_turn`。同一轮用户消息内的多步工具调用均留在同一次对话轮内。
- **anthropic.ts**：`/v1/messages` SSE 客户端（fetch + ReadableStream 解析），封装鉴权头 `x-api-key` 与 `anthropic-version`。
- **tools/**：内置工具注册表，每个工具定义 JSON Schema 参数 + 执行器，统一签名。
- **mcp/**：MCP client。streamable HTTP transport（POST JSON-RPC、SSE 响应流），实现 `initialize` 握手、`tools/list`、`tools/call`。MCP 工具命名为 `mcp__<server>__<tool>`，与内置工具同层分发。

### 4.3 页面提取（`src/content/extract.ts`）

被 `chrome.scripting.executeScript` 注入的纯函数，返回：

```ts
interface PageContent {
  title: string;
  url: string;
  description: string;        // meta description
  text: string;               // 结构化正文：保留标题层级/段落/链接文本
  images: { src: string; alt: string; width: number; height: number }[];
}
```

提取策略：`document.body` 遍历，跳过 `script/style/nav/footer` 等噪音节点，按标题与段落组织文本；收集 `img` 元素尺寸信息供 `get_page_images` 选择。

### 4.4 共享层（`src/shared/`）

- **types.ts**：Settings、SessionState、ChatMessage、PageContent 等类型
- **storage.ts**：chrome.storage.local 读写封装与默认值

## 5. 内置工具集

| 工具 | 参数 | 作用 |
|---|---|---|
| `get_page_content` | `tabId?` | 提取指定标签页结构化文本，默认当前标签页 |
| `get_screenshot` | — | `chrome.tabs.captureVisibleTab` 截取当前可视区域，作为 vision 图片输入 |
| `get_page_images` | `tabId?`, `index?`（默认前 3 张） | fetch 页面 img src 转 base64 作为图片输入；`data:` URL 直接使用，`blob:` URL 无法跨上下文获取则跳过 |
| `list_tabs` | — | 列出所有标签页（tabId/title/url/是否当前） |
| `read_tab` | `tabId` | 提取指定标签页内容注入本轮上下文（与 UI 勾选同一提取实现） |

工具执行失败不抛异常中断循环，按 Anthropic 规范以 `tool_result` 的 `is_error: true` 回传，由模型决定重试或换路。

## 6. 上下文管理

- 打开面板时，默认将「当前标签页」（侧边栏所在窗口的活动标签页）加入上下文；此后上下文**不随**用户切换标签页而自动变化，仅通过 UI 勾选或 `read_tab` 改变
- 每次发送消息时，所有已选标签页内容以标注块形式注入首条上下文（`<page tabId=... title=... url=...>...</page>`）
- 单页内容超过 `maxPageChars`（默认 50,000 字符）则截断并在块内标注截断信息
- `contextTabIds` 持久化，但标签页 ID 重启后不稳定：恢复会话时过滤掉已不存在的标签页
- agent 通过 `read_tab` 拉取的内容作为普通 assistant/tool 消息进入对话历史

## 7. 配置与数据模型

```ts
interface Settings {
  baseUrl: string;            // 默认 https://api.anthropic.com
  apiKey: string;
  model: string;
  systemPrompt: string;       // 默认值见下
  mcpServers: { name: string; url: string; headers?: Record<string, string> }[];
  maxPageChars: number;       // 默认 50000
}

interface SessionState {
  messages: ChatMessage[];    // 对话消息（含工具调用记录）
  contextTabIds: number[];
}
```

存储键（chrome.storage.local）：`settings`、`session`。

**默认系统提示词**：以 Claude Code 官方 agent 系统提示词为底本，保留工具使用规范与安全约束，替换文件系统语境为浏览器语境（读页面/查标签页），控制在适度长度。用户可在设置中编辑并恢复默认。

## 8. 错误处理

| 场景 | 处理 |
|---|---|
| API 401/403 | 错误卡片提示检查 apiKey/baseUrl，附设置页跳转 |
| API 429/5xx/网络错误 | 错误卡片 + 重试按钮（重发上一条用户消息） |
| 流式中断（面板关闭） | 接受中断；重开面板后历史已持久化的部分可继续对话 |
| 工具执行失败 | `tool_result(is_error)` 回传，不中断循环 |
| 页面不可提取（chrome://、Web Store） | 明确错误信息说明该类页面不支持 |
| MCP server 连接失败/掉线 | 设置页与工具调用处标记离线，不阻塞主对话 |
| 上下文超限（Anthropic 报错） | 原样展示错误信息，提示清空会话或减少上下文标签页 |

## 9. 测试策略

- **Vitest 单测**（纯逻辑，无浏览器依赖）：
  - 页面文本截断逻辑
  - 工具注册表：schema 生成、MCP 工具命名与分发
  - MCP JSON-RPC 请求/响应编解码
  - Anthropic SSE 流解析器
  - storage 封装的默认值合并
- **手动 E2E 清单**（加载 `dist/` 到 chrome://extensions）：
  1. 配置端点/密钥/模型 → 基本问答
  2. 当前页面内容问答（验证提取与注入）
  3. 截图与图片抓取（vision 模型）
  4. 勾选多个标签页提问；`read_tab` 工具调用
  5. 添加远程 MCP server → 工具发现与调用
  6. 断开 API/MCP → 错误提示与恢复

## 10. 项目结构

```
llm_browser_ext/
├── manifest.json            # CRXJS 入口（defineManifest 或 manifest 源文件）
├── vite.config.ts
├── package.json
├── src/
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── components/      # Chat / TabPicker / Settings / ToolTrace
│   │   └── agent/
│   │       ├── loop.ts
│   │       ├── anthropic.ts
│   │       ├── tools/       # registry.ts + 各内置工具
│   │       └── mcp/         # client.ts + transport.ts
│   ├── content/
│   │   └── extract.ts       # 注入函数
│   ├── background/
│   │   └── index.ts         # side panel 注册
│   └── shared/
│       ├── types.ts
│       └── storage.ts
├── tests/                   # Vitest 单测
└── docs/superpowers/specs/
```
