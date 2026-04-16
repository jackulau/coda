export interface HistoryEntry {
  url: string
  title: string
  visitedAt: number
  visitCount: number
}

export interface UrlValidationResult {
  ok: boolean
  kind?: "invalid-url" | "blocked-scheme" | "empty"
  normalized?: string
}

const ALLOWED_SCHEMES = new Set(["http:", "https:"])

export function normalizeUrl(raw: string): UrlValidationResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, kind: "empty" }
  const candidate = /^[a-z][a-z0-9+\-.]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  let u: URL
  try {
    u = new URL(candidate)
  } catch {
    return { ok: false, kind: "invalid-url" }
  }
  if (!ALLOWED_SCHEMES.has(u.protocol)) return { ok: false, kind: "blocked-scheme" }
  return { ok: true, normalized: u.toString() }
}

export class BrowserHistory {
  private entries = new Map<string, HistoryEntry>()
  private order: string[] = []

  constructor(private readonly cap = 2000) {}

  visit(url: string, title: string, at: number): HistoryEntry {
    const existing = this.entries.get(url)
    if (existing) {
      existing.title = title
      existing.visitedAt = at
      existing.visitCount += 1
      this.touchOrder(url)
      return existing
    }
    const entry: HistoryEntry = { url, title, visitedAt: at, visitCount: 1 }
    this.entries.set(url, entry)
    this.order.push(url)
    if (this.entries.size > this.cap) {
      const oldest = this.order.shift()
      if (oldest) this.entries.delete(oldest)
    }
    return entry
  }

  private touchOrder(url: string): void {
    const idx = this.order.indexOf(url)
    if (idx >= 0) this.order.splice(idx, 1)
    this.order.push(url)
  }

  autocomplete(prefix: string, limit = 5): HistoryEntry[] {
    const p = prefix.trim().toLowerCase()
    if (!p) return []
    const candidates: HistoryEntry[] = []
    for (const e of this.entries.values()) {
      if (e.url.toLowerCase().includes(p) || e.title.toLowerCase().includes(p)) {
        candidates.push(e)
      }
    }
    candidates.sort((a, b) => b.visitCount - a.visitCount || b.visitedAt - a.visitedAt)
    return candidates.slice(0, limit)
  }

  size(): number {
    return this.entries.size
  }
}

export interface TabState {
  id: string
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
}

export interface NavStep {
  url: string
  title: string
}

export class TabNavStack {
  private back: NavStep[] = []
  private forward: NavStep[] = []
  private current: NavStep | null = null

  navigate(step: NavStep): void {
    if (this.current) this.back.push(this.current)
    this.current = step
    this.forward = []
  }

  goBack(): NavStep | null {
    const prev = this.back.pop()
    if (!prev) return null
    if (this.current) this.forward.push(this.current)
    this.current = prev
    return prev
  }

  goForward(): NavStep | null {
    const next = this.forward.pop()
    if (!next) return null
    if (this.current) this.back.push(this.current)
    this.current = next
    return next
  }

  canGoBack(): boolean {
    return this.back.length > 0
  }

  canGoForward(): boolean {
    return this.forward.length > 0
  }

  currentStep(): NavStep | null {
    return this.current
  }
}
