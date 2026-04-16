export interface CheckpointEvent {
  id: string
  workspaceId: string
  createdAt: number
  label: string
  refSha: string
  author: "user" | "agent" | "auto"
  parentId?: string
}

export interface TimelineGroup {
  key: string
  label: string
  items: CheckpointEvent[]
}

const DAY_MS = 24 * 60 * 60 * 1000

export function groupByDay(events: CheckpointEvent[], now: number): TimelineGroup[] {
  const byDay = new Map<string, CheckpointEvent[]>()
  for (const e of events) {
    const d = new Date(e.createdAt)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate(),
    ).padStart(2, "0")}`
    let bucket = byDay.get(key)
    if (!bucket) {
      bucket = []
      byDay.set(key, bucket)
    }
    bucket.push(e)
  }
  const groups: TimelineGroup[] = []
  for (const [key, items] of byDay) {
    items.sort((a, b) => b.createdAt - a.createdAt)
    groups.push({ key, label: dayLabel(key, now), items })
  }
  groups.sort((a, b) => (a.key > b.key ? -1 : 1))
  return groups
}

function dayLabel(key: string, now: number): string {
  const today = formatDateKey(now)
  const yesterday = formatDateKey(now - DAY_MS)
  if (key === today) return "Today"
  if (key === yesterday) return "Yesterday"
  return key
}

function formatDateKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`
}

export function filterBySearch(events: CheckpointEvent[], query: string): CheckpointEvent[] {
  const q = query.trim().toLowerCase()
  if (!q) return events
  return events.filter(
    (e) => e.label.toLowerCase().includes(q) || e.refSha.toLowerCase().includes(q),
  )
}

export function restorePlan(
  events: CheckpointEvent[],
  targetId: string,
): { ok: boolean; targetSha?: string; reason?: string } {
  const target = events.find((e) => e.id === targetId)
  if (!target) return { ok: false, reason: "not-found" }
  return { ok: true, targetSha: target.refSha }
}
