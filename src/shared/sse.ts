// 逐 chunk 喂入，遇到完整 data: 行时回调（SSE 事件负载字符串）
export function createSseParser(onData: (data: string) => void): (chunk: string) => void {
  let buffer = ''
  return (chunk: string) => {
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('data:')) onData(trimmed.slice(5).trim())
    }
  }
}
