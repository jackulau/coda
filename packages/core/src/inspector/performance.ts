export interface LayoutShiftEntry {
  value: number
  startTime: number
  hadRecentInput: boolean
}

export function computeCls(entries: LayoutShiftEntry[]): number {
  let sessionValue = 0
  let sessionStart = 0
  let sessionEnd = 0
  let worst = 0
  for (const e of entries) {
    if (e.hadRecentInput) continue
    if (
      sessionValue === 0 ||
      e.startTime - sessionEnd > 1000 ||
      e.startTime - sessionStart > 5000
    ) {
      sessionValue = e.value
      sessionStart = e.startTime
      sessionEnd = e.startTime
    } else {
      sessionValue += e.value
      sessionEnd = e.startTime
    }
    if (sessionValue > worst) worst = sessionValue
  }
  return Number(worst.toFixed(4))
}

export function computeInp(durations: number[]): number {
  if (durations.length === 0) return 0
  const sorted = [...durations].sort((a, b) => a - b)
  const idx = Math.ceil(sorted.length * 0.98) - 1
  return sorted[Math.max(0, idx)] ?? 0
}

export interface PaintEntry {
  name: string
  startTime: number
}

export function pickFcp(entries: PaintEntry[]): number | undefined {
  const fcp = entries.find((e) => e.name === "first-contentful-paint")
  return fcp?.startTime
}

export interface NavigationTimingSample {
  domainLookupStart: number
  domainLookupEnd: number
  connectStart: number
  connectEnd: number
  secureConnectionStart?: number
  requestStart: number
  responseStart: number
  responseEnd: number
  domContentLoadedEventEnd: number
  loadEventEnd: number
}

export interface NavigationBreakdown {
  dns: number
  tcp: number
  tls: number
  ttfb: number
  download: number
  domEvents: number
}

export function breakdownNavigation(s: NavigationTimingSample): NavigationBreakdown {
  return {
    dns: s.domainLookupEnd - s.domainLookupStart,
    tcp: s.connectEnd - s.connectStart,
    tls:
      s.secureConnectionStart && s.secureConnectionStart > 0
        ? s.connectEnd - s.secureConnectionStart
        : 0,
    ttfb: s.responseStart - s.requestStart,
    download: s.responseEnd - s.responseStart,
    domEvents: s.loadEventEnd - s.domContentLoadedEventEnd,
  }
}

export interface LoafEntry {
  startTime: number
  duration: number
  invokerType?: string
  sourceURL?: string
}

export class BoundedLoafBuffer {
  private entries: LoafEntry[] = []
  constructor(private readonly cap = 50) {}
  add(e: LoafEntry): void {
    this.entries.push(e)
    if (this.entries.length > this.cap) this.entries.shift()
  }
  list(): LoafEntry[] {
    return [...this.entries]
  }
  size(): number {
    return this.entries.length
  }
}

export interface ResourceEntry {
  startTime: number
  transferSize: number
  encodedBodySize: number
  initiatorType?: string
}

export function isFromCache(r: ResourceEntry): boolean {
  return r.transferSize === 0 && r.encodedBodySize > 0
}

export function sortResourceWaterfall(entries: ResourceEntry[]): ResourceEntry[] {
  return [...entries].sort((a, b) => a.startTime - b.startTime)
}
