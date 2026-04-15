export interface LockHold {
  resourceId: string
  holderId: string
  acquiredAt: number
}

export interface LockWait {
  resourceId: string
  waiterId: string
  waitingSince: number
}

export interface DeadlockReport {
  cycle: string[]
  involvedResources: string[]
}

export class LockGraph {
  private holds = new Map<string, LockHold>()
  private waits = new Map<string, LockWait[]>()

  acquire(resourceId: string, holderId: string, now: number): boolean {
    if (this.holds.has(resourceId)) return false
    this.holds.set(resourceId, { resourceId, holderId, acquiredAt: now })
    return true
  }

  release(resourceId: string, holderId: string): boolean {
    const h = this.holds.get(resourceId)
    if (!h || h.holderId !== holderId) return false
    this.holds.delete(resourceId)
    this.waits.delete(resourceId)
    return true
  }

  enqueue(resourceId: string, waiterId: string, now: number): void {
    const arr = this.waits.get(resourceId) ?? []
    arr.push({ resourceId, waiterId, waitingSince: now })
    this.waits.set(resourceId, arr)
  }

  dequeue(resourceId: string, waiterId: string): void {
    const arr = this.waits.get(resourceId)
    if (!arr) return
    const idx = arr.findIndex((w) => w.waiterId === waiterId)
    if (idx >= 0) arr.splice(idx, 1)
  }

  detectDeadlock(): DeadlockReport | null {
    const adj = new Map<string, Set<string>>()
    for (const [resourceId, waiters] of this.waits) {
      const holder = this.holds.get(resourceId)?.holderId
      if (!holder) continue
      for (const w of waiters) {
        if (w.waiterId === holder) continue
        const set = adj.get(w.waiterId) ?? new Set()
        set.add(holder)
        adj.set(w.waiterId, set)
      }
    }

    const visiting = new Set<string>()
    const visited = new Set<string>()
    const stack: string[] = []

    const dfs = (node: string): string[] | null => {
      if (visiting.has(node)) {
        const cycleStart = stack.indexOf(node)
        return cycleStart >= 0 ? stack.slice(cycleStart) : [node]
      }
      if (visited.has(node)) return null
      visiting.add(node)
      stack.push(node)
      const neighbors = adj.get(node) ?? new Set()
      for (const n of neighbors) {
        const cycle = dfs(n)
        if (cycle) return cycle
      }
      stack.pop()
      visiting.delete(node)
      visited.add(node)
      return null
    }

    for (const node of adj.keys()) {
      const cycle = dfs(node)
      if (cycle && cycle.length > 1) {
        const involved = new Set<string>()
        for (const [resId, h] of this.holds) {
          if (cycle.includes(h.holderId)) involved.add(resId)
        }
        return { cycle, involvedResources: Array.from(involved).sort() }
      }
    }
    return null
  }

  longestWait(now: number): number {
    let max = 0
    for (const arr of this.waits.values()) {
      for (const w of arr) {
        max = Math.max(max, now - w.waitingSince)
      }
    }
    return max
  }

  reset(): void {
    this.holds.clear()
    this.waits.clear()
  }
}
