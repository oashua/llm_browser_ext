import type { ImageBlock, ToolOutput, ToolResultBlock } from '../../shared/types'

// 从 wire 格式的 tool_result 提取轨迹展示所需的文本与图片（图片此前被丢弃导致截图不可见）
export function traceOutputFromResult(result: ToolResultBlock): ToolOutput {
  if (typeof result.content === 'string') {
    return { text: result.content, isError: result.is_error }
  }
  const blocks = result.content
  const text = blocks
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
  const images = blocks.filter((b): b is ImageBlock => b.type === 'image')
  return { text, images: images.length ? images : undefined, isError: result.is_error }
}
