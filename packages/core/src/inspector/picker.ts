export interface InspectableRect {
  id: string
  x: number
  y: number
  w: number
  h: number
  zIndex: number
  display: "block" | "inline" | "none"
  visibility: "visible" | "hidden"
  isOverlay?: boolean
}

export interface PickOptions {
  threshold?: number
}

export interface PickerState {
  last: { x: number; y: number; result: InspectableRect | null } | null
  invalidated: number
}

export function createPickerState(): PickerState {
  return { last: null, invalidated: 0 }
}

export function invalidatePositionCache(state: PickerState): void {
  state.last = null
  state.invalidated += 1
}

export function isVisible(r: InspectableRect): boolean {
  if (r.display === "none") return false
  if (r.visibility === "hidden") return false
  if (r.w <= 0 || r.h <= 0) return false
  return true
}

export function rectContains(r: InspectableRect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h
}

export function getElementAtPoint(
  rects: InspectableRect[],
  x: number,
  y: number,
  state: PickerState = createPickerState(),
  opts: PickOptions = {},
): InspectableRect | null {
  const threshold = opts.threshold ?? 3
  if (state.last) {
    const dx = x - state.last.x
    const dy = y - state.last.y
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return state.last.result
  }
  const hits = rects.filter((r) => !r.isOverlay && isVisible(r) && rectContains(r, x, y))
  hits.sort((a, b) => b.zIndex - a.zIndex)
  const top = hits[0] ?? null
  state.last = { x, y, result: top }
  return top
}
