export class LspAdapter {
  private nextId = 1
  private pending = new Map<number, { method: string; sentAt: number }>()
  request(method: string, now: number): number {
    const id = this.nextId++
    this.pending.set(id, { method, sentAt: now })
    return id
  }
  resolve(id: number): { method: string } | null {
    const entry = this.pending.get(id)
    if (!entry) return null
    this.pending.delete(id)
    return { method: entry.method }
  }
  pendingCount(): number {
    return this.pending.size
  }
  pruneStale(nowMs: number, staleAfterMs: number): number[] {
    const dropped: number[] = []
    for (const [id, entry] of this.pending) {
      if (nowMs - entry.sentAt > staleAfterMs) {
        this.pending.delete(id)
        dropped.push(id)
      }
    }
    return dropped
  }
}
