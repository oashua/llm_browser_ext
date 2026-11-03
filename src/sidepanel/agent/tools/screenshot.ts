import type { ImageBlock, ToolDef } from '../../../shared/types'

function dataUrlToImageBlock(dataUrl: string): ImageBlock {
  const data = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }
}

export const screenshotTool: ToolDef = {
  name: 'get_screenshot',
  description: '截取当前活动标签页可视区域（JPEG）作为图像输入。适用于查看页面视觉布局、图表，或文本提取不足时。',
  inputSchema: { type: 'object', properties: {} },
  execute: async () => {
    const dataUrl = await chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT as number, {
      format: 'jpeg',
      quality: 70,
    })
    return { text: '已附加当前可视区域截图。', images: [dataUrlToImageBlock(dataUrl)] }
  },
}
