import type { ProjectInfo } from "../project"
import type { WorkspaceInfo } from "./index"

export const UNASSIGNED_PROJECT_ID = "__unassigned"

export interface ProjectGroup {
  project: ProjectInfo | null
  projectId: string
  workspaces: WorkspaceInfo[]
}

export function groupWorkspacesByProject(
  projects: ProjectInfo[],
  workspaces: WorkspaceInfo[],
): ProjectGroup[] {
  const projectById = new Map(projects.map((p) => [p.id, p]))
  const groups = new Map<string, WorkspaceInfo[]>()

  for (const w of workspaces) {
    const projId = projectById.has(w.projectId) ? w.projectId : UNASSIGNED_PROJECT_ID
    const arr = groups.get(projId) ?? []
    arr.push(w)
    groups.set(projId, arr)
  }

  const sortedProjectIds = Array.from(groups.keys()).sort((a, b) => {
    if (a === UNASSIGNED_PROJECT_ID) return 1
    if (b === UNASSIGNED_PROJECT_ID) return -1
    const pa = projectById.get(a)
    const pb = projectById.get(b)
    return projectOrder(pa, pb)
  })

  return sortedProjectIds.map((id) => ({
    project: projectById.get(id) ?? null,
    projectId: id,
    workspaces: sortWorkspaces(groups.get(id) ?? []),
  }))
}

function projectOrder(a: ProjectInfo | undefined, b: ProjectInfo | undefined): number {
  const oa = a?.uiOrder ?? Number.POSITIVE_INFINITY
  const ob = b?.uiOrder ?? Number.POSITIVE_INFINITY
  if (oa !== ob) return oa - ob
  return (a?.name ?? "").localeCompare(b?.name ?? "")
}

export function sortWorkspaces(rows: WorkspaceInfo[]): WorkspaceInfo[] {
  return [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    const oa = a.uiOrder ?? Number.POSITIVE_INFINITY
    const ob = b.uiOrder ?? Number.POSITIVE_INFINITY
    if (oa !== ob) return oa - ob
    const la = a.lastFocusedAt ?? 0
    const lb = b.lastFocusedAt ?? 0
    if (la !== lb) return lb - la
    return a.name.localeCompare(b.name)
  })
}

const FORMAT_THRESHOLD = 99_999

export function formatDiffCount(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return "—"
  if (n === 0) return null
  if (n > FORMAT_THRESHOLD) return "99k+"
  return String(n)
}

export const TRUNCATION_TOLERANCE = 32

export function truncateName(name: string, max = 32): string {
  if (name.length <= max) return name
  return `${name.slice(0, max - 1)}…`
}
