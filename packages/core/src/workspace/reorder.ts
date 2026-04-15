import type { WorkspaceInfo } from "./index"

export interface ReorderInput {
  items: WorkspaceInfo[]
  draggedId: string
  targetId: string
  position: "before" | "after"
}

export interface ReorderResult {
  changed: boolean
  items: WorkspaceInfo[]
}

export function applyReorder(input: ReorderInput): ReorderResult {
  if (input.draggedId === input.targetId) {
    return { changed: false, items: input.items }
  }

  const dragged = input.items.find((i) => i.id === input.draggedId)
  const target = input.items.find((i) => i.id === input.targetId)
  if (!dragged || !target) return { changed: false, items: input.items }

  const sameProject = input.items.filter(
    (i) => i.projectId === target.projectId && i.id !== input.draggedId,
  )
  const others = input.items.filter(
    (i) => i.projectId !== target.projectId && i.id !== input.draggedId,
  )

  const targetIdx = sameProject.findIndex((i) => i.id === input.targetId)
  if (targetIdx === -1) return { changed: false, items: input.items }

  const insertAt = input.position === "before" ? targetIdx : targetIdx + 1
  const draggedReparented: WorkspaceInfo = { ...dragged, projectId: target.projectId }
  sameProject.splice(insertAt, 0, draggedReparented)

  const reordered = sameProject.map((row, i) => ({ ...row, uiOrder: (i + 1) * 100 }))

  if (
    input.draggedId === input.targetId ||
    (samePositionAtIndex(reordered, dragged, dragged.uiOrder) &&
      dragged.projectId === target.projectId)
  ) {
    return { changed: false, items: input.items }
  }

  return { changed: true, items: [...others, ...reordered] }
}

function samePositionAtIndex(
  rows: WorkspaceInfo[],
  dragged: WorkspaceInfo,
  oldOrder: number | undefined,
): boolean {
  const found = rows.find((r) => r.id === dragged.id)
  if (!found) return false
  return found.uiOrder === oldOrder
}

export function pinToggle(rows: WorkspaceInfo[], id: string, pinned: boolean): WorkspaceInfo[] {
  return rows.map((r) => (r.id === id ? { ...r, pinned } : r))
}
