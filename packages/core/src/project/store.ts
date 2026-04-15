import { codaBus } from "../event/bus"
import { ProjectInfo } from "./index"

export interface ProjectUpdatePatch {
  uiOrder?: number
  expanded?: boolean
  name?: string
}

const rows = new Map<string, ProjectInfo>()

export const ProjectStore = {
  upsert(row: ProjectInfo): ProjectInfo {
    const parsed = ProjectInfo.parse(row)
    rows.set(parsed.id, parsed)
    return parsed
  },

  get(id: string): ProjectInfo | undefined {
    return rows.get(id)
  },

  list(): ProjectInfo[] {
    return Array.from(rows.values())
  },

  update(id: string, patch: ProjectUpdatePatch): ProjectInfo {
    const cur = rows.get(id)
    if (!cur) throw new Error(`project not found: ${id}`)

    if (patch.uiOrder !== undefined && !Number.isFinite(patch.uiOrder)) {
      throw new Error("uiOrder must be a finite number")
    }

    const next: ProjectInfo = {
      ...cur,
      ...(patch.uiOrder !== undefined && { uiOrder: patch.uiOrder }),
      ...(patch.expanded !== undefined && { expanded: patch.expanded }),
      ...(patch.name !== undefined && { name: patch.name }),
    }
    const validated = ProjectInfo.parse(next)
    rows.set(id, validated)
    codaBus.emit("Project.Updated", {
      id,
      uiOrder: validated.uiOrder,
      expanded: validated.expanded,
    })
    return validated
  },

  delete(id: string): boolean {
    return rows.delete(id)
  },

  clear(): void {
    rows.clear()
  },
}
