export interface VirtualWindowInput {
  scrollTop: number
  viewportHeight: number
  rowHeight: number
  itemCount: number
  overscan?: number
}

export interface VirtualWindow {
  start: number
  end: number
  offsetY: number
  visibleCount: number
  totalHeight: number
}

export function computeWindow(input: VirtualWindowInput): VirtualWindow {
  if (input.rowHeight <= 0) throw new Error("rowHeight must be positive")
  if (input.itemCount < 0) throw new Error("itemCount must be non-negative")
  const overscan = Math.max(0, input.overscan ?? 4)
  const scrollTop = Math.max(0, input.scrollTop)
  const rawStart = Math.floor(scrollTop / input.rowHeight)
  const visible = Math.ceil(input.viewportHeight / input.rowHeight)
  const start = Math.max(0, Math.min(input.itemCount, rawStart - overscan))
  const end = Math.max(start, Math.min(input.itemCount, rawStart + visible + overscan))
  const offsetY = start * input.rowHeight
  return {
    start,
    end,
    offsetY,
    visibleCount: end - start,
    totalHeight: input.itemCount * input.rowHeight,
  }
}
