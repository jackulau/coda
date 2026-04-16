export interface DiffComment {
  id: string
  sessionId: string
  workspaceId: string
  file: string
  lineNumber: number
  body: string
  author: "agent" | "user"
  createdAt: number
  resolved: boolean
  resolvedAt: number | null
}

export type DiffCommentEvent =
  | { kind: "diff_comment.created"; id: string }
  | { kind: "diff_comment.resolved"; id: string }
  | { kind: "diff_comment.unresolved"; id: string }
  | { kind: "diff_comment.deleted"; id: string }

export class DiffCommentStore {
  private readonly comments = new Map<string, DiffComment>()
  private listeners: Array<(e: DiffCommentEvent) => void> = []

  onEvent(cb: (e: DiffCommentEvent) => void): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((x) => x !== cb)
    }
  }

  create(c: Omit<DiffComment, "resolved" | "resolvedAt">): DiffComment {
    const stored: DiffComment = { ...c, resolved: false, resolvedAt: null }
    this.comments.set(c.id, stored)
    this.emit({ kind: "diff_comment.created", id: c.id })
    return stored
  }

  resolve(id: string, at: number): boolean {
    const c = this.comments.get(id)
    if (!c || c.resolved) return false
    this.comments.set(id, { ...c, resolved: true, resolvedAt: at })
    this.emit({ kind: "diff_comment.resolved", id })
    return true
  }

  unresolve(id: string): boolean {
    const c = this.comments.get(id)
    if (!c || !c.resolved) return false
    this.comments.set(id, { ...c, resolved: false, resolvedAt: null })
    this.emit({ kind: "diff_comment.unresolved", id })
    return true
  }

  delete(id: string): boolean {
    const ok = this.comments.delete(id)
    if (ok) this.emit({ kind: "diff_comment.deleted", id })
    return ok
  }

  listBySession(sessionId: string): DiffComment[] {
    return [...this.comments.values()]
      .filter((c) => c.sessionId === sessionId)
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  listByFile(sessionId: string, file: string): DiffComment[] {
    return this.listBySession(sessionId).filter((c) => c.file === file)
  }

  countByFile(sessionId: string): Record<string, number> {
    const out: Record<string, number> = {}
    for (const c of this.listBySession(sessionId)) {
      out[c.file] = (out[c.file] ?? 0) + 1
    }
    return out
  }

  private emit(e: DiffCommentEvent): void {
    for (const cb of this.listeners) cb(e)
  }
}
