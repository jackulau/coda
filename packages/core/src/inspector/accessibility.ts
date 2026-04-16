export type A11yImpact = "critical" | "serious" | "moderate" | "minor"

export interface A11yViolation {
  id: string
  impact: A11yImpact
  description: string
  helpUrl: string
  nodes: { target: string[]; html?: string }[]
}

export interface A11yAuditResult {
  violations: A11yViolation[]
  passes: { id: string }[]
  incomplete: { id: string }[]
}

const IMPACT_ORDER: Record<A11yImpact, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
}

export function sortViolations(vs: A11yViolation[]): A11yViolation[] {
  return [...vs].sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact])
}

const OVERLAY_MARKERS = ["__coda_inspector_"]

export function excludeOverlayNodes(v: A11yViolation): A11yViolation {
  return {
    ...v,
    nodes: v.nodes.filter((n) => !n.target.some((t) => OVERLAY_MARKERS.some((m) => t.includes(m)))),
  }
}

export function pruneEmptyViolations(vs: A11yViolation[]): A11yViolation[] {
  return vs.map(excludeOverlayNodes).filter((v) => v.nodes.length > 0)
}

export function formatReport(result: A11yAuditResult): string {
  const sorted = sortViolations(pruneEmptyViolations(result.violations))
  const lines: string[] = []
  lines.push(`Violations: ${sorted.length}`)
  for (const v of sorted) {
    lines.push(`- [${v.impact}] ${v.id}: ${v.description}`)
    lines.push(`  help: ${v.helpUrl}`)
    lines.push(`  nodes: ${v.nodes.length}`)
  }
  lines.push(`Passes: ${result.passes.length}`)
  lines.push(`Incomplete: ${result.incomplete.length}`)
  return lines.join("\n")
}

export interface AxeSource {
  loaded: boolean
  failed: boolean
  reason?: string
}

export function canRunAudit(src: AxeSource): { ok: boolean; reason?: string } {
  if (!src.loaded) return { ok: false, reason: "axe not loaded" }
  if (src.failed) return { ok: false, reason: src.reason ?? "axe load failed" }
  return { ok: true }
}
