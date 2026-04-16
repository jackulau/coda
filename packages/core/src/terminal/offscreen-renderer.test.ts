import { describe, expect, test } from "bun:test"

import {
  type CanvasLike,
  type Context2DLike,
  type LineDiff,
  OffscreenCapableRenderer,
  type PlatformCapabilities,
  type RendererEnv,
  type RendererGeometry,
  type WorkerLike,
  detectCapabilities,
  shouldUseWorker,
} from "./offscreen-renderer"

// ---- fakes ------------------------------------------------------------------

function makeCtx(): Context2DLike & {
  calls: Array<{ op: string; args: unknown[] }>
} {
  const ctx = {
    fillStyle: "",
    font: "",
    textBaseline: "top" as const,
    calls: [] as Array<{ op: string; args: unknown[] }>,
    fillRect(x: number, y: number, w: number, h: number) {
      this.calls.push({ op: "fillRect", args: [x, y, w, h] })
    },
    clearRect(x: number, y: number, w: number, h: number) {
      this.calls.push({ op: "clearRect", args: [x, y, w, h] })
    },
    fillText(text: string, x: number, y: number) {
      this.calls.push({ op: "fillText", args: [text, x, y] })
    },
    save() {
      this.calls.push({ op: "save", args: [] })
    },
    restore() {
      this.calls.push({ op: "restore", args: [] })
    },
  }
  return ctx
}

function makeCanvas(withTransfer: boolean): CanvasLike & { ctx: Context2DLike } {
  const ctx = makeCtx()
  const canvas: CanvasLike & { ctx: Context2DLike } = {
    width: 0,
    height: 0,
    ctx,
    getContext: () => ctx,
    transferControlToOffscreen: withTransfer ? () => ({ __offscreen: true }) : undefined,
  }
  return canvas
}

function makeFakeRaf() {
  const state = {
    queued: [] as Array<() => void>,
    nextId: 1,
    requestAnimationFrame(cb: () => void) {
      const id = state.nextId++
      state.queued.push(cb)
      return id
    },
    cancelAnimationFrame(_id: unknown) {
      // no-op — tests drive the queue explicitly
    },
    flush() {
      const q = state.queued.slice()
      state.queued = []
      for (const cb of q) cb()
    },
  }
  return state
}

function makeWorker(): WorkerLike & { sent: unknown[]; terminated: boolean } {
  const w = {
    sent: [] as unknown[],
    terminated: false,
    postMessage(data: unknown) {
      this.sent.push(data)
    },
    terminate() {
      this.terminated = true
    },
  }
  return w
}

const GEOM: RendererGeometry = {
  cols: 80,
  rows: 24,
  cellWidth: 8,
  cellHeight: 16,
  devicePixelRatio: 2,
}

function envNoWorker(raf: ReturnType<typeof makeFakeRaf>): RendererEnv {
  const caps: PlatformCapabilities = {
    hasOffscreenCanvas: false,
    hasWorker: false,
    hasTransferControlToOffscreen: false,
  }
  return {
    capabilities: caps,
    requestAnimationFrame: raf.requestAnimationFrame,
    cancelAnimationFrame: raf.cancelAnimationFrame,
  }
}

function envWithWorker(
  raf: ReturnType<typeof makeFakeRaf>,
  worker: ReturnType<typeof makeWorker>,
): RendererEnv {
  const caps: PlatformCapabilities = {
    hasOffscreenCanvas: true,
    hasWorker: true,
    hasTransferControlToOffscreen: true,
  }
  return {
    capabilities: caps,
    createWorker: () => worker,
    requestAnimationFrame: raf.requestAnimationFrame,
    cancelAnimationFrame: raf.cancelAnimationFrame,
  }
}

// ---- tests ------------------------------------------------------------------

describe("detectCapabilities", () => {
  test("reports false for all when globals absent", () => {
    const caps = detectCapabilities({} as typeof globalThis)
    expect(caps.hasOffscreenCanvas).toBe(false)
    expect(caps.hasWorker).toBe(false)
    expect(caps.hasTransferControlToOffscreen).toBe(false)
  })

  test("reports true when globals present", () => {
    const fakeGlobal = {
      OffscreenCanvas: () => {},
      Worker: () => {},
      HTMLCanvasElement: { prototype: { transferControlToOffscreen: () => {} } },
    } as unknown as typeof globalThis
    const caps = detectCapabilities(fakeGlobal)
    expect(caps.hasOffscreenCanvas).toBe(true)
    expect(caps.hasWorker).toBe(true)
    expect(caps.hasTransferControlToOffscreen).toBe(true)
  })
})

describe("shouldUseWorker", () => {
  test("false when any capability missing", () => {
    expect(
      shouldUseWorker({
        hasOffscreenCanvas: true,
        hasWorker: true,
        hasTransferControlToOffscreen: false,
      }),
    ).toBe(false)
    expect(
      shouldUseWorker({
        hasOffscreenCanvas: false,
        hasWorker: true,
        hasTransferControlToOffscreen: true,
      }),
    ).toBe(false)
  })
  test("true when all present", () => {
    expect(
      shouldUseWorker({
        hasOffscreenCanvas: true,
        hasWorker: true,
        hasTransferControlToOffscreen: true,
      }),
    ).toBe(true)
  })
  test("forceMainThread overrides", () => {
    expect(
      shouldUseWorker(
        {
          hasOffscreenCanvas: true,
          hasWorker: true,
          hasTransferControlToOffscreen: true,
        },
        true,
      ),
    ).toBe(false)
  })
})

describe("OffscreenCapableRenderer — main-thread path", () => {
  test("picks mainthread mode when capabilities lack worker", () => {
    const raf = makeFakeRaf()
    const canvas = makeCanvas(false)
    const r = new OffscreenCapableRenderer({
      canvas,
      geometry: GEOM,
      env: envNoWorker(raf),
    })
    expect(r.mode).toBe("mainthread")
    r.dispose()
  })

  test("sets canvas pixel size from geometry + DPR", () => {
    const raf = makeFakeRaf()
    const canvas = makeCanvas(false)
    new OffscreenCapableRenderer({ canvas, geometry: GEOM, env: envNoWorker(raf) })
    expect(canvas.width).toBe(GEOM.cols * GEOM.cellWidth * GEOM.devicePixelRatio)
    expect(canvas.height).toBe(GEOM.rows * GEOM.cellHeight * GEOM.devicePixelRatio)
  })

  test("batches diffs into a single raf flush", () => {
    const raf = makeFakeRaf()
    const canvas = makeCanvas(false)
    const r = new OffscreenCapableRenderer({ canvas, geometry: GEOM, env: envNoWorker(raf) })
    r.render([{ line: 0, text: "a" }])
    r.render([{ line: 1, text: "b" }])
    r.render([{ line: 2, text: "c" }])
    expect(raf.queued.length).toBe(1)
    raf.flush()
    const ctx = canvas.ctx as ReturnType<typeof makeCtx>
    // At least one fillText per diff
    const fillTexts = ctx.calls.filter((c) => c.op === "fillText")
    expect(fillTexts.length).toBe(3)
    r.dispose()
  })

  test("flushForTest forces synchronous rendering", () => {
    const raf = makeFakeRaf()
    const canvas = makeCanvas(false)
    const r = new OffscreenCapableRenderer({ canvas, geometry: GEOM, env: envNoWorker(raf) })
    r.render([{ line: 0, text: "hi" }])
    r.flushForTest()
    const ctx = canvas.ctx as ReturnType<typeof makeCtx>
    expect(ctx.calls.some((c) => c.op === "fillText" && c.args[0] === "hi")).toBe(true)
    r.dispose()
  })

  test("dispose stops accepting renders", () => {
    const raf = makeFakeRaf()
    const canvas = makeCanvas(false)
    const r = new OffscreenCapableRenderer({ canvas, geometry: GEOM, env: envNoWorker(raf) })
    r.dispose()
    r.render([{ line: 0, text: "zzz" }])
    expect(raf.queued.length).toBe(0)
  })
})

describe("OffscreenCapableRenderer — worker path", () => {
  test("picks worker mode when all capabilities present", () => {
    const raf = makeFakeRaf()
    const worker = makeWorker()
    const canvas = makeCanvas(true)
    const r = new OffscreenCapableRenderer({
      canvas,
      geometry: GEOM,
      env: envWithWorker(raf, worker),
    })
    expect(r.mode).toBe("worker")
    r.dispose()
  })

  test("init message transfers the OffscreenCanvas to the worker", () => {
    const raf = makeFakeRaf()
    const worker = makeWorker()
    const canvas = makeCanvas(true)
    new OffscreenCapableRenderer({
      canvas,
      geometry: GEOM,
      env: envWithWorker(raf, worker),
    })
    expect(worker.sent.length).toBe(1)
    const init = worker.sent[0] as { type: string; canvas: unknown; geom: RendererGeometry }
    expect(init.type).toBe("init")
    expect(init.canvas).toBeTruthy()
    expect(init.geom).toEqual(GEOM)
  })

  test("render batches line diffs into one worker draw message per raf", () => {
    const raf = makeFakeRaf()
    const worker = makeWorker()
    const canvas = makeCanvas(true)
    const r = new OffscreenCapableRenderer({
      canvas,
      geometry: GEOM,
      env: envWithWorker(raf, worker),
    })
    // Reset sent — we already consumed the init message.
    worker.sent = []

    r.render([{ line: 0, text: "a" }])
    r.render([{ line: 1, text: "b" }])
    r.render([{ line: 2, text: "c" }])
    expect(worker.sent).toEqual([])
    raf.flush()
    expect(worker.sent.length).toBe(1)
    const msg = worker.sent[0] as { type: string; diff: LineDiff[] }
    expect(msg.type).toBe("draw")
    expect(msg.diff.map((d) => d.line)).toEqual([0, 1, 2])
    r.dispose()
  })

  test("never sends full buffer copies — only diffs", () => {
    const raf = makeFakeRaf()
    const worker = makeWorker()
    const canvas = makeCanvas(true)
    const r = new OffscreenCapableRenderer({
      canvas,
      geometry: GEOM,
      env: envWithWorker(raf, worker),
    })
    worker.sent = []
    const diff: LineDiff[] = [{ line: 5, text: "x" }]
    r.render(diff)
    raf.flush()
    const msg = worker.sent[0] as { type: string; diff: LineDiff[] }
    // The message carries exactly the emitted diff, not a 24-row snapshot.
    expect(msg.diff).toEqual(diff)
    expect(msg.diff.length).toBeLessThan(GEOM.rows)
    r.dispose()
  })

  test("resize forwards a message to the worker", () => {
    const raf = makeFakeRaf()
    const worker = makeWorker()
    const canvas = makeCanvas(true)
    const r = new OffscreenCapableRenderer({
      canvas,
      geometry: GEOM,
      env: envWithWorker(raf, worker),
    })
    worker.sent = []
    const next = { ...GEOM, cols: 100 }
    r.resize(next)
    expect(worker.sent.length).toBe(1)
    const msg = worker.sent[0] as { type: string; geom: RendererGeometry }
    expect(msg.type).toBe("resize")
    expect(msg.geom.cols).toBe(100)
    r.dispose()
  })

  test("dispose terminates the worker", () => {
    const raf = makeFakeRaf()
    const worker = makeWorker()
    const canvas = makeCanvas(true)
    const r = new OffscreenCapableRenderer({
      canvas,
      geometry: GEOM,
      env: envWithWorker(raf, worker),
    })
    r.dispose()
    expect(worker.terminated).toBe(true)
  })

  test("forceMainThread bypasses the worker even when capable", () => {
    const raf = makeFakeRaf()
    const worker = makeWorker()
    const canvas = makeCanvas(true)
    const r = new OffscreenCapableRenderer({
      canvas,
      geometry: GEOM,
      env: envWithWorker(raf, worker),
      forceMainThread: true,
    })
    expect(r.mode).toBe("mainthread")
    expect(worker.sent.length).toBe(0)
    r.dispose()
  })
})
