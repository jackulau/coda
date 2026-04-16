// R10: OffscreenCanvas + Worker terminal renderer.
//
// `OffscreenCapableRenderer` picks the best path for the environment:
//   - If `OffscreenCanvas` + `Worker` + `HTMLCanvasElement.transferControlToOffscreen`
//     are all available, glyph rendering runs in a worker so the main thread
//     stays responsive while scrolling.
//   - Otherwise (Safari pre-16.4, jsdom, SSR, feature-disabled), we fall back
//     to a main-thread `CanvasRenderingContext2D` path.
//
// Both paths accept the same `LineDiff[]` messages — we never ship full buffer
// copies across the boundary, only the visible lines that changed since the
// last frame. Draw calls are coalesced into `requestAnimationFrame` windows.
//
// The module is testable without a real DOM: all platform APIs are injectable
// through the `RendererEnv` seam.

export interface LineDiff {
  /** 0-based row within the visible viewport. */
  line: number
  /** New text content for that row. */
  text: string
  /** Optional styling (color + bold/italic). Preserved across the seam. */
  style?: {
    fg?: string
    bg?: string
    bold?: boolean
    italic?: boolean
  }
}

export type RendererMode = "worker" | "mainthread"

export interface RendererGeometry {
  cols: number
  rows: number
  cellWidth: number
  cellHeight: number
  devicePixelRatio: number
}

export interface Renderer {
  readonly mode: RendererMode
  /** Queue a batch of line diffs. Flushed at the next RAF tick. */
  render(diff: LineDiff[]): void
  /** Change viewport geometry. Triggers a full redraw. */
  resize(geom: RendererGeometry): void
  /** Release resources (worker, canvas context). */
  dispose(): void
  /** For tests: force-flush pending frames synchronously. */
  flushForTest(): void
}

export interface PlatformCapabilities {
  hasOffscreenCanvas: boolean
  hasWorker: boolean
  hasTransferControlToOffscreen: boolean
}

export interface CanvasLike {
  width: number
  height: number
  transferControlToOffscreen?: () => unknown
  getContext(type: "2d"): Context2DLike | null
}

export interface Context2DLike {
  fillStyle: string
  font: string
  textBaseline: CanvasTextBaseline
  fillRect(x: number, y: number, w: number, h: number): void
  clearRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  save(): void
  restore(): void
}

export interface WorkerLike {
  postMessage(data: unknown, transfer?: unknown[]): void
  terminate(): void
  addEventListener?(event: "message", handler: (ev: { data: unknown }) => void): void
}

export interface RendererEnv {
  capabilities: PlatformCapabilities
  createWorker?: () => WorkerLike
  requestAnimationFrame: (cb: () => void) => unknown
  cancelAnimationFrame: (id: unknown) => void
}

export interface OffscreenCapableRendererOptions {
  canvas: CanvasLike
  geometry: RendererGeometry
  env?: RendererEnv
  /** Force the main-thread path even if offscreen is available (dev flag). */
  forceMainThread?: boolean
}

// ---- capability detection ---------------------------------------------------

export function detectCapabilities(globalObj: typeof globalThis = globalThis): PlatformCapabilities {
  const g = globalObj as unknown as {
    OffscreenCanvas?: unknown
    Worker?: unknown
    HTMLCanvasElement?: { prototype?: { transferControlToOffscreen?: unknown } }
  }
  return {
    hasOffscreenCanvas: typeof g.OffscreenCanvas === "function",
    hasWorker: typeof g.Worker === "function",
    hasTransferControlToOffscreen:
      typeof g.HTMLCanvasElement?.prototype?.transferControlToOffscreen === "function",
  }
}

export function shouldUseWorker(caps: PlatformCapabilities, forceMainThread?: boolean): boolean {
  if (forceMainThread) return false
  return caps.hasOffscreenCanvas && caps.hasWorker && caps.hasTransferControlToOffscreen
}

// ---- main-thread renderer ---------------------------------------------------

class MainThreadRenderer implements Renderer {
  readonly mode: RendererMode = "mainthread"
  private ctx: Context2DLike | null
  private pending: LineDiff[] = []
  private rafId: unknown = null
  private disposed = false
  private geom: RendererGeometry
  private raf: (cb: () => void) => unknown
  private cancel: (id: unknown) => void

  constructor(canvas: CanvasLike, geom: RendererGeometry, env: RendererEnv) {
    this.ctx = canvas.getContext("2d")
    this.geom = geom
    this.raf = env.requestAnimationFrame
    this.cancel = env.cancelAnimationFrame
    canvas.width = geom.cols * geom.cellWidth * geom.devicePixelRatio
    canvas.height = geom.rows * geom.cellHeight * geom.devicePixelRatio
  }

  render(diff: LineDiff[]): void {
    if (this.disposed) return
    for (const d of diff) this.pending.push(d)
    if (this.rafId === null) {
      this.rafId = this.raf(() => {
        this.rafId = null
        this.flush()
      })
    }
  }

  resize(geom: RendererGeometry): void {
    this.geom = geom
  }

  flushForTest(): void {
    if (this.rafId !== null) {
      this.cancel(this.rafId)
      this.rafId = null
    }
    this.flush()
  }

  dispose(): void {
    this.disposed = true
    if (this.rafId !== null) {
      this.cancel(this.rafId)
      this.rafId = null
    }
    this.pending = []
    this.ctx = null
  }

  private flush(): void {
    if (!this.ctx || this.pending.length === 0) return
    const ctx = this.ctx
    const { cellWidth, cellHeight, devicePixelRatio: dpr } = this.geom
    for (const d of this.pending) {
      const y = d.line * cellHeight * dpr
      ctx.save()
      ctx.fillStyle = d.style?.bg ?? "#000"
      ctx.fillRect(0, y, cellWidth * this.geom.cols * dpr, cellHeight * dpr)
      ctx.fillStyle = d.style?.fg ?? "#f0f0f0"
      const weight = d.style?.bold ? "bold " : ""
      const slant = d.style?.italic ? "italic " : ""
      ctx.font = `${slant}${weight}${cellHeight * dpr * 0.85}px monospace`
      ctx.textBaseline = "top"
      ctx.fillText(d.text, 0, y)
      ctx.restore()
    }
    this.pending = []
  }
}

// ---- worker renderer --------------------------------------------------------

class WorkerRenderer implements Renderer {
  readonly mode: RendererMode = "worker"
  private worker: WorkerLike | null
  private pending: LineDiff[] = []
  private rafId: unknown = null
  private disposed = false
  private geom: RendererGeometry
  private raf: (cb: () => void) => unknown
  private cancel: (id: unknown) => void

  constructor(canvas: CanvasLike, geom: RendererGeometry, env: RendererEnv) {
    if (!env.createWorker) throw new Error("createWorker missing but capabilities say worker OK")
    this.worker = env.createWorker()
    this.geom = geom
    this.raf = env.requestAnimationFrame
    this.cancel = env.cancelAnimationFrame

    canvas.width = geom.cols * geom.cellWidth * geom.devicePixelRatio
    canvas.height = geom.rows * geom.cellHeight * geom.devicePixelRatio
    const offscreen = canvas.transferControlToOffscreen?.()
    this.worker.postMessage({ type: "init", canvas: offscreen, geom }, offscreen ? [offscreen] : [])
  }

  render(diff: LineDiff[]): void {
    if (this.disposed) return
    for (const d of diff) this.pending.push(d)
    if (this.rafId === null) {
      this.rafId = this.raf(() => {
        this.rafId = null
        this.flush()
      })
    }
  }

  resize(geom: RendererGeometry): void {
    this.geom = geom
    this.worker?.postMessage({ type: "resize", geom })
  }

  flushForTest(): void {
    if (this.rafId !== null) {
      this.cancel(this.rafId)
      this.rafId = null
    }
    this.flush()
  }

  dispose(): void {
    this.disposed = true
    if (this.rafId !== null) {
      this.cancel(this.rafId)
      this.rafId = null
    }
    this.pending = []
    this.worker?.terminate()
    this.worker = null
  }

  private flush(): void {
    if (!this.worker || this.pending.length === 0) return
    // Only send the diff, never a full buffer copy.
    this.worker.postMessage({ type: "draw", diff: this.pending })
    this.pending = []
  }
}

// ---- public façade ---------------------------------------------------------

export class OffscreenCapableRenderer implements Renderer {
  private inner: Renderer

  constructor(opts: OffscreenCapableRendererOptions) {
    const env = opts.env ?? defaultEnv()
    const useWorker = shouldUseWorker(env.capabilities, opts.forceMainThread)
    this.inner = useWorker
      ? new WorkerRenderer(opts.canvas, opts.geometry, env)
      : new MainThreadRenderer(opts.canvas, opts.geometry, env)
  }

  get mode(): RendererMode {
    return this.inner.mode
  }

  render(diff: LineDiff[]): void {
    this.inner.render(diff)
  }

  resize(geom: RendererGeometry): void {
    this.inner.resize(geom)
  }

  dispose(): void {
    this.inner.dispose()
  }

  flushForTest(): void {
    this.inner.flushForTest()
  }
}

function defaultEnv(): RendererEnv {
  const caps = detectCapabilities()
  const raf =
    typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : (cb: () => void) => setTimeout(cb, 16)
  const caf =
    typeof globalThis.cancelAnimationFrame === "function"
      ? globalThis.cancelAnimationFrame.bind(globalThis)
      : (id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>)
  return {
    capabilities: caps,
    requestAnimationFrame: raf,
    cancelAnimationFrame: caf,
  }
}
