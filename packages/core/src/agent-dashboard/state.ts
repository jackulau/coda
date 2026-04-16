export type AgentStatus = "idle" | "running" | "awaiting-input" | "error" | "finished"

export interface AgentRun {
  id: string
  workspaceId: string
  agentKind: "claude-code" | "codex" | "copilot" | "gemini" | "amp"
  status: AgentStatus
  startedAt: number
  lastActivityAt: number
  tokenCount: number
  cost: number
  label: string
}

export interface DashboardSummary {
  total: number
  byStatus: Record<AgentStatus, number>
  totalTokens: number
  totalCost: number
  activeWorkspaces: string[]
}

export function summarize(runs: AgentRun[]): DashboardSummary {
  const byStatus: Record<AgentStatus, number> = {
    idle: 0,
    running: 0,
    "awaiting-input": 0,
    error: 0,
    finished: 0,
  }
  let totalTokens = 0
  let totalCost = 0
  const ws = new Set<string>()
  for (const r of runs) {
    byStatus[r.status] += 1
    totalTokens += r.tokenCount
    totalCost += r.cost
    ws.add(r.workspaceId)
  }
  return {
    total: runs.length,
    byStatus,
    totalTokens,
    totalCost,
    activeWorkspaces: Array.from(ws).sort(),
  }
}

export function sortDashboard(runs: AgentRun[]): AgentRun[] {
  const rank: Record<AgentStatus, number> = {
    error: 0,
    "awaiting-input": 1,
    running: 2,
    idle: 3,
    finished: 4,
  }
  return [...runs].sort((a, b) => {
    const r = rank[a.status] - rank[b.status]
    if (r !== 0) return r
    return b.lastActivityAt - a.lastActivityAt
  })
}

export function needsAttention(runs: AgentRun[]): AgentRun[] {
  return runs.filter((r) => r.status === "awaiting-input" || r.status === "error")
}
