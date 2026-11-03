import type { WireMessage } from '../../shared/types'

// 供「重试」使用：定位最后一条用户文本消息与其在数组中的截断下标
export function lastUserQuery(messages: WireMessage[]): { text: string; cutoff: number } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const text = m.content.find((b) => b.type === 'text')?.text
    if (text) return { text, cutoff: i }
  }
  return null
}
