export interface PtySessionSnapshot {
  id: string
  workspaceId: string
  cwd: string
  shell: string
  exitedAt: number | null
  exitCode: number | null
  claudeSessionId: string | null
}

export type ReattachPlanEntry =
  | { kind: "reattach"; id: string; workspaceId: string; cwd: string; shell: string }
  | { kind: "history"; id: string; reason: "clean-exit" | "crashed" }
  | { kind: "failed"; id: string; reason: "cwd-missing" | "workspace-deleted" }

export interface ReattachEnv {
  cwdExists: (path: string) => boolean
  workspaceExists?: (workspaceId: string) => boolean
}

export function planReattach(
  sessions: PtySessionSnapshot[],
  env: ReattachEnv,
): ReattachPlanEntry[] {
  const out: ReattachPlanEntry[] = []
  const workspaceExists = env.workspaceExists ?? (() => true)
  for (const s of sessions) {
    if (s.exitedAt !== null) {
      out.push({
        kind: "history",
        id: s.id,
        reason: s.exitCode === 0 ? "clean-exit" : "crashed",
      })
      continue
    }
    if (!workspaceExists(s.workspaceId)) {
      out.push({ kind: "failed", id: s.id, reason: "workspace-deleted" })
      continue
    }
    if (!env.cwdExists(s.cwd)) {
      out.push({ kind: "failed", id: s.id, reason: "cwd-missing" })
      continue
    }
    out.push({
      kind: "reattach",
      id: s.id,
      workspaceId: s.workspaceId,
      cwd: s.cwd,
      shell: s.shell,
    })
  }
  return out
}

export interface ResizeEvent {
  cols: number
  rows: number
}

export class HiddenResizeBuffer {
  private pending = new Map<string, ResizeEvent>()

  stash(paneId: string, ev: ResizeEvent): void {
    this.pending.set(paneId, ev)
  }

  flush(paneId: string): ResizeEvent | null {
    const ev = this.pending.get(paneId) ?? null
    this.pending.delete(paneId)
    return ev
  }

  size(): number {
    return this.pending.size
  }

  clear(): void {
    this.pending.clear()
  }
}

export interface ScrollbackRing {
  window: string[]
  capacity: number
}

export function advanceScrollback(ring: ScrollbackRing, incoming: string[]): ScrollbackRing {
  const combined = [...ring.window, ...incoming]
  const trimmed =
    combined.length > ring.capacity ? combined.slice(combined.length - ring.capacity) : combined
  return { window: trimmed, capacity: ring.capacity }
}
