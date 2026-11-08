import type { Settings, ToolContext, ToolDef, ToolOutput } from '../../../shared/types'
import { imagesTool } from './images'
import { pageContentTool, readTabTool } from './pageContent'
import { screenshotTool } from './screenshot'
import { getSettingsTool, updateSettingsTool } from './settings'
import { listTabsTool } from './tabs'

// list_tabs/read_tab 仅在设置开启 allowTabEnumeration 时注册（默认关闭，隐私边界）
export function builtinTools(s?: Pick<Settings, 'allowTabEnumeration'>): ToolDef[] {
  const tools = [pageContentTool, screenshotTool, imagesTool, getSettingsTool, updateSettingsTool]
  if (s?.allowTabEnumeration) tools.push(listTabsTool, readTabTool)
  return tools
}

// 在内置 + MCP 工具列表中查找并执行；未知工具返回错误输出而非抛异常
export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  tools: ToolDef[],
): Promise<ToolOutput> {
  const tool = builtinTools(ctx.settings).find((t) => t.name === name) ?? tools.find((t) => t.name === name)
  if (!tool) return { text: `未知工具: ${name}`, isError: true }
  return tool.execute(args, ctx)
}
