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
  /** 由 App 注入：应用配置补丁（持久化+生效）并返回更新后的完整配置 */
  updateSettings?: (patch: Partial<Settings>) => Promise<Settings>
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
  /** 允许 agent 枚举/读取未勾选的标签页（list_tabs/read_tab 工具），默认关闭 */
  allowTabEnumeration: boolean
}

export interface SessionState {
  messages: WireMessage[]
  contextTabIds: number[]
}
