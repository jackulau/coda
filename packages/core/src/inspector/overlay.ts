export interface OverlayConfig {
  canvasWidth: number
  canvasHeight: number
  devicePixelRatio: number
  borderRadius: number
}

export interface OverlayFrame {
  x: number
  y: number
  w: number
  h: number
  borderRadius: number
}

export function canvasDimensions(cfg: OverlayConfig): { width: number; height: number } {
  return {
    width: Math.round(cfg.canvasWidth * cfg.devicePixelRatio),
    height: Math.round(cfg.canvasHeight * cfg.devicePixelRatio),
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

export function interpolateFrame(from: OverlayFrame, to: OverlayFrame, t: number): OverlayFrame {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    w: lerp(from.w, to.w, t),
    h: lerp(from.h, to.h, t),
    borderRadius: lerp(from.borderRadius, to.borderRadius, t),
  }
}

export const OVERLAY_CLASS_PREFIX = "__coda_inspector_"

export function isOverlayId(id: string): boolean {
  return id.startsWith(OVERLAY_CLASS_PREFIX)
}

export function filterOutOverlay<T extends { id: string }>(nodes: T[]): T[] {
  return nodes.filter((n) => !isOverlayId(n.id))
}
