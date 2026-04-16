import type { LogLevel, LogRecord } from "./writer"

export interface LogQuery {
  levels?: LogLevel[]
  sources?: string[]
  since?: number
  until?: number
  text?: string
  limit?: number
}

export function parseLines(lines: string[]): LogRecord[] {
  const out: LogRecord[] = []
  for (const line of lines) {
    if (!line) continue
    try {
      const rec = JSON.parse(line) as LogRecord
      if (
        typeof rec.ts === "number" &&
        typeof rec.level === "string" &&
        typeof rec.source === "string" &&
        typeof rec.msg === "string"
      ) {
        out.push(rec)
      }
    } catch {
      // skip malformed lines
    }
  }
  return out
}

export function queryLogs(records: LogRecord[], q: LogQuery): LogRecord[] {
  const levels = q.levels ? new Set(q.levels) : null
  const sources = q.sources ? new Set(q.sources) : null
  const textLower = q.text?.toLowerCase()
  const filtered: LogRecord[] = []
  for (const r of records) {
    if (levels && !levels.has(r.level)) continue
    if (sources && !sources.has(r.source)) continue
    if (q.since !== undefined && r.ts < q.since) continue
    if (q.until !== undefined && r.ts > q.until) continue
    if (textLower) {
      if (!r.msg.toLowerCase().includes(textLower)) continue
    }
    filtered.push(r)
  }
  filtered.sort((a, b) => a.ts - b.ts)
  if (q.limit !== undefined && filtered.length > q.limit) {
    return filtered.slice(filtered.length - q.limit)
  }
  return filtered
}
