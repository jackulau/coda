import { codaBus } from "../event/bus"
import { WorkspaceStore } from "../workspace/store"
import { type PtySession, PtySession as PtySessionSchema } from "./index"

const rows = new Map<string, PtySession>()

export interface PtySessionCreate {
  id?: string
  workspaceId: string
  cwd: string
  title: string
  claudeSessionId?: string
  pid?: number
}

export const PtySessionStore = {
  create(input: PtySessionCreate): PtySession {
    if (!WorkspaceStore.get(input.workspaceId)) {
      throw new ForeignKeyError(`workspace not found: ${input.workspaceId}`)
    }
    const row: PtySession = PtySessionSchema.parse({
      id: input.id ?? crypto.randomUUID(),
      workspaceId: input.workspaceId,
      cwd: input.cwd,
      title: input.title,
      claudeSessionId: input.claudeSessionId,
      pid: input.pid,
      startedAt: Date.now(),
    })
    rows.set(row.id, row)
    codaBus.emit("PtySession.Created", { id: row.id, workspaceId: row.workspaceId })
    return row
  },

  get(id: string): PtySession | undefined {
    return rows.get(id)
  },

  listByWorkspace(workspaceId: string): PtySession[] {
    return Array.from(rows.values())
      .filter((r) => r.workspaceId === workspaceId)
      .sort((a, b) => a.startedAt - b.startedAt)
  },

  update(
    id: string,
    patch: Partial<Pick<PtySession, "title" | "claudeSessionId" | "pid">>,
  ): PtySession {
    const cur = rows.get(id)
    if (!cur) throw new Error(`session not found: ${id}`)
    const next: PtySession = PtySessionSchema.parse({ ...cur, ...patch })
    rows.set(id, next)
    return next
  },

  markExited(id: string, exitCode: number): PtySession {
    const cur = rows.get(id)
    if (!cur) throw new Error(`session not found: ${id}`)
    const at = Date.now()
    const next: PtySession = PtySessionSchema.parse({
      ...cur,
      exitedAt: at,
      exitCode,
    })
    rows.set(id, next)
    codaBus.emit("PtySession.Exited", { id, exitCode, at })
    return next
  },

  remove(id: string): boolean {
    return rows.delete(id)
  },

  clear(): void {
    rows.clear()
  },

  deleteByWorkspace(workspaceId: string): number {
    let n = 0
    for (const [id, row] of rows) {
      if (row.workspaceId === workspaceId) {
        rows.delete(id)
        n++
      }
    }
    return n
  },
}

export class ForeignKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ForeignKeyError"
  }
}

export function wirePtySessionCascade(): () => void {
  return codaBus.on("Workspace.Deleted", (e) => {
    PtySessionStore.deleteByWorkspace(e.id)
  })
}

wirePtySessionCascade()
