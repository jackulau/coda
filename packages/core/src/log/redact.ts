const PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: /sk-ant-[A-Za-z0-9_-]{16,}/g, replacement: "sk-ant-<redacted>" },
  { re: /github_pat_[A-Za-z0-9_]{16,}/g, replacement: "github_pat_<redacted>" },
  { re: /ghp_[A-Za-z0-9]{16,}/g, replacement: "ghp_<redacted>" },
  { re: /ghs_[A-Za-z0-9]{16,}/g, replacement: "ghs_<redacted>" },
  { re: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "AKIA<redacted>" },
  {
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    replacement: "<uuid>",
  },
  { re: /(authorization:\s*(token|bearer)\s+)\S+/gi, replacement: "$1<redacted>" },
  {
    re: /(["']?(api[_-]?key|secret|password)["']?\s*[:=]\s*["']?)([^"'\s,}<]+)/gi,
    replacement: "$1<redacted>",
  },
  {
    re: /(["']?token["']?\s*[:=]\s*["']?)(?!ghp_|ghs_|github_pat_|sk-ant-)([^"'\s,}<]+)/gi,
    replacement: "$1<redacted>",
  },
  { re: /\bsk-[A-Za-z0-9_-]{16,}\b/g, replacement: "sk-<redacted>" },
]

export function redact(input: string): string {
  let out = input
  for (const { re, replacement } of PATTERNS) {
    out = out.replace(re, replacement)
  }
  return out
}

export function redactObject<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (typeof value === "string") return redact(value) as T
  if (Array.isArray(value)) return value.map((v) => redactObject(v)) as unknown as T
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (/api[_-]?key|secret|password|token/i.test(k) && typeof v === "string") {
        out[k] = "<redacted>"
      } else {
        out[k] = redactObject(v)
      }
    }
    return out as T
  }
  return value
}
