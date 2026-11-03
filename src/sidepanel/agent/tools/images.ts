import { fetchPageContent } from './pageContent'
import type { ImageBlock, ToolDef, PageImageInfo } from '../../../shared/types'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const SUPPORTED_MEDIA = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function dataUrlToImageBlock(dataUrl: string): ImageBlock | null {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl)
  if (!m) return null
  if (!SUPPORTED_MEDIA.includes(m[1])) return null
  return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }
}

async function urlToDataUrl(url: string): Promise<string> {
  const blob = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.blob()
  })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

// 默认取面积最大的 3 张（≥64px），不足时回退前 3 张
function defaultPicks(images: PageImageInfo[]): number[] {
  const big = images
    .map((im, i) => ({ i, area: im.width * im.height }))
    .filter((x) => x.area >= 64 * 64)
    .sort((a, b) => b.area - a.area)
    .slice(0, 3)
    .map((x) => x.i)
    .sort((a, b) => a - b)
  if (big.length) return big
  return [0, 1, 2].filter((i) => i < images.length)
}

export const imagesTool: ToolDef = {
  name: 'get_page_images',
  description:
    '获取指定标签页页面中的图片作为图像输入。默认取面积最大的 3 张大图；可用 index（0 起的序号数组，对应 get_page_content 返回的图片列表）指定。',
  inputSchema: {
    type: 'object',
    properties: {
      tabId: { type: 'number', description: '目标标签页 ID，默认当前标签页' },
      index: { type: 'array', items: { type: 'number' }, description: '图片序号列表，如 [0, 2]' },
    },
  },
  execute: async (args) => {
    const pc = await fetchPageContent(args.tabId as number | undefined)
    const want = Array.isArray(args.index) && args.index.length ? (args.index as number[]) : defaultPicks(pc.images)
    const images: ImageBlock[] = []
    const skipped: string[] = []
    for (const i of want) {
      const info = pc.images[i]
      if (!info) {
        skipped.push(`#${i} 不存在`)
        continue
      }
      if (info.src.startsWith('blob:')) {
        skipped.push(`#${i} blob 图片无法跨上下文获取`)
        continue
      }
      try {
        const dataUrl = info.src.startsWith('data:') ? info.src : await urlToDataUrl(info.src)
        if (dataUrl.length > MAX_IMAGE_BYTES * 1.4) {
          skipped.push(`#${i} 过大`)
          continue
        }
        const block = dataUrlToImageBlock(dataUrl)
        if (block) images.push(block)
        else skipped.push(`#${i} 格式不支持`)
      } catch {
        skipped.push(`#${i} 获取失败`)
      }
    }
    const summary = `页面共 ${pc.images.length} 张图片，已加载 ${images.length} 张。${skipped.length ? `跳过: ${skipped.join('、')}` : ''}`
    return { text: summary, images }
  },
}
