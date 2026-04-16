export type StatusSeverity = "info" | "warn" | "error"

export interface StatusItem {
  id: string
  side: "left" | "right"
  text: string
  tooltip?: string
  severity?: StatusSeverity
  priority: number
  command?: string
}

export class StatusBarModel {
  private items = new Map<string, StatusItem>()
  private listeners: Array<(items: StatusItem[]) => void> = []

  upsert(item: StatusItem): void {
    this.items.set(item.id, item)
    this.notify()
  }

  remove(id: string): boolean {
    const ok = this.items.delete(id)
    if (ok) this.notify()
    return ok
  }

  render(): { left: StatusItem[]; right: StatusItem[] } {
    const left: StatusItem[] = []
    const right: StatusItem[] = []
    for (const item of this.items.values()) {
      if (item.side === "left") left.push(item)
      else right.push(item)
    }
    const bySev: Record<StatusSeverity, number> = { error: 0, warn: 1, info: 2 }
    const cmp = (a: StatusItem, b: StatusItem) => {
      const sa = bySev[a.severity ?? "info"]
      const sb = bySev[b.severity ?? "info"]
      if (sa !== sb) return sa - sb
      return b.priority - a.priority
    }
    left.sort(cmp)
    right.sort(cmp)
    return { left, right }
  }

  onChange(cb: (items: StatusItem[]) => void): () => void {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((x) => x !== cb)
    }
  }

  private notify(): void {
    const list = [...this.items.values()]
    for (const cb of this.listeners) cb(list)
  }
}

export function summaryText(problems: {
  errors: number
  warnings: number
}): string {
  if (problems.errors === 0 && problems.warnings === 0) return "No problems"
  const parts: string[] = []
  if (problems.errors > 0) parts.push(`${problems.errors} error${problems.errors === 1 ? "" : "s"}`)
  if (problems.warnings > 0)
    parts.push(`${problems.warnings} warning${problems.warnings === 1 ? "" : "s"}`)
  return parts.join(", ")
}
