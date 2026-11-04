import type { Settings, ToolDef } from '../../../shared/types'

// 允许通过对话修改的配置项（apiKey/baseUrl 只能在设置页手动改）
const EDITABLE_KEYS = ['model', 'systemPrompt', 'maxPageChars', 'mcpServers']

function maskSettings(s: Settings): string {
  return JSON.stringify({ ...s, apiKey: s.apiKey ? '***' : '' }, null, 2)
}

// 校验 patch，返回错误信息；合法返回 null
function validatePatch(patch: Record<string, unknown>): string | null {
  for (const k of Object.keys(patch)) {
    if (k === 'apiKey' || k === 'baseUrl') return `不允许通过对话修改 ${k}，请在扩展设置页手动更改`
    if (!EDITABLE_KEYS.includes(k)) return `未知配置项: ${k}（可修改: ${EDITABLE_KEYS.join(', ')}）`
  }
  if (patch.model !== undefined && typeof patch.model !== 'string') return 'model 必须是字符串'
  if (patch.systemPrompt !== undefined && typeof patch.systemPrompt !== 'string')
    return 'systemPrompt 必须是字符串'
  if (
    patch.maxPageChars !== undefined &&
    (typeof patch.maxPageChars !== 'number' || !Number.isFinite(patch.maxPageChars) || patch.maxPageChars < 500)
  )
    return 'maxPageChars 必须是不小于 500 的数字'
  if (patch.mcpServers !== undefined) {
    if (!Array.isArray(patch.mcpServers)) return 'mcpServers 必须是数组'
    for (const srv of patch.mcpServers as Array<Record<string, unknown>>) {
      if (typeof srv?.name !== 'string' || typeof srv?.url !== 'string')
        return '每个 MCP server 需要字符串字段 name 与 url'
    }
  }
  return null
}

export const getSettingsTool: ToolDef = {
  name: 'get_settings',
  description:
    '查看当前扩展配置（模型名、系统提示词、单页截断长度、MCP servers；apiKey 脱敏显示）。apiKey 与 baseUrl 需在扩展设置页手动修改。',
  inputSchema: { type: 'object', properties: {} },
  execute: async (_args, ctx) => ({ text: maskSettings(ctx.settings) }),
}

export const updateSettingsTool: ToolDef = {
  name: 'update_settings',
  description:
    '修改自己的配置并立即生效。可改字段：model（模型名）、systemPrompt（系统提示词全文，整体替换）、maxPageChars（单页截断字符数，≥500）、mcpServers（完整列表，整体替换，元素 {name,url,headers?}）。apiKey/baseUrl 不可通过对话修改。',
  inputSchema: {
    type: 'object',
    properties: {
      model: { type: 'string', description: '新模型名，如 glm-4.7' },
      systemPrompt: { type: 'string', description: '新的系统提示词全文' },
      maxPageChars: { type: 'number', description: '单页内容截断上限（字符）' },
      mcpServers: {
        type: 'array',
        description: 'MCP server 完整列表（整体替换）',
        items: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' } } },
      },
    },
  },
  execute: async (args, ctx) => {
    const err = validatePatch(args)
    if (err) return { text: err, isError: true }
    if (!ctx.updateSettings) return { text: '当前运行环境未接入配置修改，无法生效', isError: true }
    const next = await ctx.updateSettings(args as Partial<Settings>)
    return { text: `配置已更新并生效：\n${maskSettings(next)}` }
  },
}
