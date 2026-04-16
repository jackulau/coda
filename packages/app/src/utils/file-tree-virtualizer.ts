export interface VirtualWindow {
  startIndex: number
  endIndex: number
  offsetY: number
}

export function computeWindow(
  totalRows: number,
  rowHeight: number,
  viewportHeight: number,
  scrollTop: number,
  overscan = 5,
): VirtualWindow {
  if (totalRows <= 0) return { startIndex: 0, endIndex: 0, offsetY: 0 }
  const firstVisible = Math.floor(scrollTop / rowHeight)
  const lastVisible = Math.ceil((scrollTop + viewportHeight) / rowHeight)
  const startIndex = Math.max(0, firstVisible - overscan)
  const endIndex = Math.min(totalRows, lastVisible + overscan)
  const offsetY = startIndex * rowHeight
  return { startIndex, endIndex, offsetY }
}
