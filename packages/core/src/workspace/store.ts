import { codaBus } from "../event/bus"
import { WorkspaceInfo } from "./index"

export interface WorkspaceUpdatePatch {
  uiOrder?: number
  lastFocusedAt?: number
  pinned?: boolean
}

const rows = new Map<string, WorkspaceInfo>()

export const WorkspaceStore = {
  upsert(row: WorkspaceInfo): WorkspaceInfo {
    const parsed = WorkspaceInfo.parse(row)
    rows.set(parsed.id, parsed)
    codaBus.emit("Workspace.Created", { id: parsed.id, projectId: parsed.projectId })
    return parsed
  },

  get(id: string): WorkspaceInfo | undefined {
    return rows.get(id)
  },

  list(): WorkspaceInfo[] {
    return Array.from(rows.values())
  },

  listByProject(projectId: string): WorkspaceInfo[] {
    return this.list().filter((w) => w.projectId === projectId)
  },

  update(id: string, patch: WorkspaceUpdatePatch): WorkspaceInfo {
    const cur = rows.get(id)
    if (!cur) throw new Error(`workspace not found: ${id}`)

    if (patch.uiOrder !== undefined && !Number.isFinite(patch.uiOrder)) {
      throw new Error("uiOrder must be a finite number")
    }

    const next: WorkspaceInfo = {
      ...cur,
      ...(patch.uiOrder !== undefined && { uiOrder: patch.uiOrder }),
      ...(patch.pinned !== undefined && { pinned: patch.pinned }),
      ...(patch.lastFocusedAt !== undefined && {
        lastFocusedAt: Math.max(cur.lastFocusedAt ?? 0, patch.lastFocusedAt),
      }),
    }
    const validated = WorkspaceInfo.parse(next)
    rows.set(id, validated)
    codaBus.emit("Workspace.Updated", {
      id,
      uiOrder: validated.uiOrder,
      lastFocusedAt: validated.lastFocusedAt,
      pinned: validated.pinned,
    })
    return validated
  },

  delete(id: string): boolean {
    const removed = rows.delete(id)
    if (removed) codaBus.emit("Workspace.Deleted", { id })
    return removed
  },

  clear(): void {
    rows.clear()
  },
}
