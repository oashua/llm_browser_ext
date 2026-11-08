import type { ToolContext, ToolDef, ToolOutput } from '../../../shared/types'
import { imagesTool } from './images'
import { pageContentTool } from './pageContent'
import { screenshotTool } from './screenshot'
import { getSettingsTool, updateSettingsTool } from './settings'

export function builtinTools(): ToolDef[] {
  // 不提供 list_tabs/read_tab：agent 无权枚举或读取用户未勾选的标签页（隐私边界）
  return [pageContentTool, screenshotTool, imagesTool, getSettingsTool, updateSettingsTool]
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
