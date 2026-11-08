import { describe, expect, it, vi } from 'vitest'
import { runAgentLoop } from '../src/sidepanel/agent/loop'
import type { Settings, ToolDef, WireMessage } from '../src/shared/types'

const settings = { baseUrl: '', apiKey: '', model: '', systemPrompt: '', mcpServers: [], maxPageChars: 50000, allowTabEnumeration: false, contextUseRawHtml: false }

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
          message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'my_echo', input: {} }] },
          stopReason: 'tool_use',
        }
      return { message: { role: 'assistant', content: [{ type: 'text', text: '完成' }] }, stopReason: 'end_turn' }
    })
    const echoTool: ToolDef = {
      name: 'my_echo', description: '', inputSchema: {},
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
    const tr = out[2].content[0] as unknown as Record<string, unknown>
    expect(tr['type']).toBe('tool_result')
    expect(tr['is_error']).toBe(true)
    expect(String(tr['content'])).toContain('炸了')
  })

  it('resolve 热更新：每 hop 重取 settings，修改立即生效', async () => {
    let round = 0
    const seenModels: string[] = []
    const streamFn = vi.fn(async (o: { settings: { model: string } }) => {
      seenModels.push(o.settings.model)
      round += 1
      if (round === 1)
        return {
          message: { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'update_settings', input: { model: 'new' } }] },
          stopReason: 'tool_use',
        }
      return { message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] }, stopReason: 'end_turn' }
    })
    let cur: Settings = { ...settings, model: 'old' }
    await runAgentLoop({
      settings: cur, system: 's', history: [textMsg('user', 'q')], tools: [], ctx: {
        settings: cur,
        updateSettings: async (patch) => {
          cur = { ...cur, ...patch }
          return cur
        },
      },
      streamFn: streamFn as any,
      resolve: () => ({ settings: cur, system: 's', tools: [] }),
    })
    expect(seenModels).toEqual(['old', 'new'])
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
