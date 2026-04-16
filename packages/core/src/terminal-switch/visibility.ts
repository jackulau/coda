export interface TerminalHandle {
  id: string
  workspaceId: string
  mounted: boolean
  display: "block" | "none"
  scrollY: number
}

export class TerminalVisibility {
  private terminals = new Map<string, TerminalHandle>()
  private lastVisibleId: string | null = null
  private mountCount = 0
  private unmountCount = 0

  add(h: TerminalHandle): void {
    if (this.terminals.has(h.id)) return
    this.terminals.set(h.id, { ...h, mounted: true, display: "none" })
    this.mountCount += 1
  }

  focus(workspaceId: string): { shown: string[]; hidden: string[] } {
    const shown: string[] = []
    const hidden: string[] = []
    for (const [id, t] of this.terminals) {
      const target: "block" | "none" = t.workspaceId === workspaceId ? "block" : "none"
      if (t.display !== target) {
        this.terminals.set(id, { ...t, display: target })
        if (target === "block") shown.push(id)
        else hidden.push(id)
      }
    }
    this.lastVisibleId = workspaceId
    return { shown, hidden }
  }

  activeWorkspace(): string | null {
    return this.lastVisibleId
  }

  saveScroll(id: string, y: number): void {
    const t = this.terminals.get(id)
    if (!t) return
    this.terminals.set(id, { ...t, scrollY: y })
  }

  getScroll(id: string): number {
    return this.terminals.get(id)?.scrollY ?? 0
  }

  remove(id: string): void {
    if (!this.terminals.delete(id)) return
    this.unmountCount += 1
  }

  stats() {
    return { mounts: this.mountCount, unmounts: this.unmountCount }
  }
}
