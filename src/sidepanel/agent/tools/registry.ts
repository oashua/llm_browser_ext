import type { ToolContext, ToolDef, ToolOutput } from '../../../shared/types'
import { imagesTool } from './images'
import { pageContentTool, readTabTool } from './pageContent'
import { screenshotTool } from './screenshot'
import { getSettingsTool, updateSettingsTool } from './settings'
import { listTabsTool } from './tabs'

export function builtinTools(): ToolDef[] {
  return [pageContentTool, screenshotTool, imagesTool, listTabsTool, readTabTool, getSettingsTool, updateSettingsTool]
}

// 在内置 + MCP 工具列表中查找并执行；未知工具返回错误输出而非抛异常
export async function dispatchTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  tools: ToolDef[],
): Promise<ToolOutput> {
  const tool = builtinTools().find((t) => t.name === name) ?? tools.find((t) => t.name === name)
  if (!tool) return { text: `未知工具: ${name}`, isError: true }
  return tool.execute(args, ctx)
}
