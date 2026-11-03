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

  const st = { baseUrl: 'https://x.com', apiKey: 'k', model: 'm', systemPrompt: '', mcpServers: [], maxPageChars: 50000 }

  it('非 2xx 抛 ApiError 且带状态码', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"bad key"}', { status: 401 })))
    await expect(streamMessage({ settings: st, system: 's', messages: [] })).rejects.toThrowError(ApiError)
    try {
      await streamMessage({ settings: st, system: 's', messages: [] })
    } catch (e) {
      expect((e as ApiError).status).toBe(401)
    }
  })

  it('正常流式响应组装完整消息', async () => {
    const sse =
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n' +
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"ok"}}\n\n' +
      'data: {"type":"content_block_stop","index":0}\n\n' +
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })),
    )
    const { message, stopReason } = await streamMessage({
      settings: st,
      system: 's',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    })
    expect(message.content).toEqual([{ type: 'text', text: 'ok' }])
    expect(stopReason).toBe('end_turn')
  })
})
