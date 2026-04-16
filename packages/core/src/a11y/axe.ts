export type Impact = "minor" | "moderate" | "serious" | "critical"

export interface AxeNode {
  target: string
  html: string
  failureSummary: string
}

export interface AxeViolation {
  id: string
  impact: Impact
  help: string
  helpUrl: string
  nodes: AxeNode[]
}

export interface AxeReport {
  violations: AxeViolation[]
  scannedAt: number
  url: string
}

const IMPACT_RANK: Record<Impact, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 }

export interface GroupedViolations {
  byImpact: Record<Impact, AxeViolation[]>
  totals: Record<Impact, number>
  totalNodes: number
}

export function groupViolations(report: AxeReport): GroupedViolations {
  const byImpact: Record<Impact, AxeViolation[]> = {
    critical: [],
    serious: [],
    moderate: [],
    minor: [],
  }
  let totalNodes = 0
  for (const v of report.violations) {
    byImpact[v.impact].push(v)
    totalNodes += v.nodes.length
  }
  for (const k of Object.keys(byImpact) as Impact[]) {
    byImpact[k].sort((a, b) => b.nodes.length - a.nodes.length || a.id.localeCompare(b.id))
  }
  return {
    byImpact,
    totals: {
      critical: byImpact.critical.length,
      serious: byImpact.serious.length,
      moderate: byImpact.moderate.length,
      minor: byImpact.minor.length,
    },
    totalNodes,
  }
}

export function prioritized(violations: AxeViolation[]): AxeViolation[] {
  return [...violations].sort((a, b) => {
    const rank = IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact]
    if (rank !== 0) return rank
    return b.nodes.length - a.nodes.length
  })
}

export interface GatePolicy {
  maxCritical: number
  maxSerious: number
}

export function gate(report: AxeReport, policy: GatePolicy): { passed: boolean; reason?: string } {
  const grouped = groupViolations(report)
  if (grouped.totals.critical > policy.maxCritical) {
    return {
      passed: false,
      reason: `${grouped.totals.critical} critical a11y issues > budget ${policy.maxCritical}`,
    }
  }
  if (grouped.totals.serious > policy.maxSerious) {
    return {
      passed: false,
      reason: `${grouped.totals.serious} serious a11y issues > budget ${policy.maxSerious}`,
    }
  }
  return { passed: true }
}
