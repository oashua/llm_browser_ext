// MCP headers 的密钥脱敏：设置页不直接展示敏感值（Authorization/token/key/secret 类）

const SENSITIVE_KEY_RE = /authorization|token|secret|key/i

const MASK = '***'

// 生成脱敏后的 JSON 草稿（用于 textarea 展示）
export function maskHeadersJson(headers: Record<string, string> | undefined): string {
  const masked: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers ?? {})) {
    masked[k] = SENSITIVE_KEY_RE.test(k) ? MASK : v
  }
  return JSON.stringify(masked, null, 2)
}

export interface MergedHeaders {
  /** 合法草稿的合并结果；空草稿为 undefined（表示清空 headers） */
  headers?: Record<string, string>
  /** false = JSON 不完整/非法，调用方不应写入 */
  valid: boolean
}

// 合并用户编辑的草稿：值为 *** 的敏感头回填原始密钥（表示未修改）
export function mergeMaskedHeaders(
  original: Record<string, string> | undefined,
  draft: string,
): MergedHeaders {
  if (!draft.trim()) return { headers: undefined, valid: true }
  let parsed: unknown
  try {
    parsed = JSON.parse(draft)
  } catch {
    return { valid: false }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { valid: false }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== 'string') continue
    out[k] = v === MASK && original?.[k] ? original[k] : v
  }
  return { headers: out, valid: true }
}
