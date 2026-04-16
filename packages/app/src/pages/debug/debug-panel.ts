export interface LogLine {
  level: string
  message: string
  ts: number
}

export function filterByLevel(lines: LogLine[], allowed: string[]): LogLine[] {
  const set = new Set(allowed)
  return lines.filter((l) => set.has(l.level))
}
