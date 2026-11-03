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
