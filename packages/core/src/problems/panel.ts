export type Severity = "error" | "warning" | "info" | "hint"

export interface Diagnostic {
  path: string
  line: number
  column: number
  severity: Severity
  source: string
  code?: string
  message: string
}

export interface DiagnosticGroup {
  path: string
  counts: Record<Severity, number>
  items: Diagnostic[]
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2, hint: 3 }

export interface FilterOptions {
  severities?: Severity[]
  sources?: string[]
  query?: string
  path?: string
}

export function filterDiagnostics(all: Diagnostic[], filter: FilterOptions = {}): Diagnostic[] {
  const sev = filter.severities ? new Set(filter.severities) : null
  const src = filter.sources ? new Set(filter.sources) : null
  const q = filter.query?.toLowerCase() ?? null
  return all.filter((d) => {
    if (sev && !sev.has(d.severity)) return false
    if (src && !src.has(d.source)) return false
    if (filter.path && d.path !== filter.path) return false
    if (
      q &&
      !d.message.toLowerCase().includes(q) &&
      !(d.code?.toLowerCase().includes(q) ?? false)
    ) {
      return false
    }
    return true
  })
}

export function groupByPath(diagnostics: Diagnostic[]): DiagnosticGroup[] {
  const map = new Map<string, DiagnosticGroup>()
  for (const d of diagnostics) {
    let g = map.get(d.path)
    if (!g) {
      g = { path: d.path, counts: { error: 0, warning: 0, info: 0, hint: 0 }, items: [] }
      map.set(d.path, g)
    }
    g.counts[d.severity]++
    g.items.push(d)
  }
  const groups = Array.from(map.values())
  for (const g of groups) {
    g.items.sort((a, b) => {
      const sr = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
      if (sr !== 0) return sr
      if (a.line !== b.line) return a.line - b.line
      return a.column - b.column
    })
  }
  groups.sort((a, b) => {
    if (b.counts.error !== a.counts.error) return b.counts.error - a.counts.error
    if (b.counts.warning !== a.counts.warning) return b.counts.warning - a.counts.warning
    return a.path.localeCompare(b.path)
  })
  return groups
}

export function totals(diagnostics: Diagnostic[]): Record<Severity, number> {
  const out: Record<Severity, number> = { error: 0, warning: 0, info: 0, hint: 0 }
  for (const d of diagnostics) out[d.severity]++
  return out
}
