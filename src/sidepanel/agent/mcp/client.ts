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
