import { afterEach, describe, expect, it, vi } from 'vitest'
import { McpClient } from '../src/sidepanel/agent/mcp/client'
import { pickResponseForId } from '../src/sidepanel/agent/mcp/transport'

afterEach(() => vi.unstubAllGlobals())

describe('pickResponseForId', () => {
  it('在 SSE 负载中找到对应 id 的 JSON-RPC 响应', () => {
    const payloads = [
      '{"jsonrpc":"2.0","method":"notifications/progress","params":{}}',
      '{"jsonrpc":"2.0","id":3,"result":{"tools":[]}}',
    ]
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
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-03-26', capabilities: {} } }),
          { status: 200, headers: { 'content-type': 'application/json', 'mcp-session-id': 'sid-1' } },
        )
      if (body.method === 'tools/list')
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
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
        body.method === 'initialize'
          ? { protocolVersion: '2025-03-26', capabilities: {} }
          : body.method === 'tools/list'
            ? { tools: [{ name: 'search', description: '', inputSchema: {} }] }
            : { content: [{ type: 'text', text: '结果 A' }], isError: false }
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })
    const client = new McpClient({ name: 'srv', url: 'https://mcp.example.com/rpc' })
    await client.connect()
    const out = await client.toolDefs()[0].execute(
      { q: 'x' },
      { settings: { baseUrl: '', apiKey: '', model: '', systemPrompt: '', mcpServers: [], maxPageChars: 50000, allowTabEnumeration: false, contextUseRawHtml: false } },
    )
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
