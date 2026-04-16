import { describe, expect, test } from "bun:test"
import { MemoryBaseline, diffAgainstBaseline, filterTrackedProps } from "./css-baseline"
import { canvasDimensions, filterOutOverlay, interpolateFrame, isOverlayId, lerp } from "./overlay"
import {
  type InspectableRect,
  createPickerState,
  getElementAtPoint,
  invalidatePositionCache,
  isVisible,
  rectContains,
} from "./picker"

const rect = (o: Partial<InspectableRect> = {}): InspectableRect => ({
  id: "el-1",
  x: 0,
  y: 0,
  w: 100,
  h: 50,
  zIndex: 0,
  display: "block",
  visibility: "visible",
  ...o,
})

describe("picker — getElementAtPoint", () => {
  test("returns topmost by z-index", () => {
    const rects = [
      rect({ id: "a", zIndex: 0 }),
      rect({ id: "b", zIndex: 5 }),
      rect({ id: "c", zIndex: 2 }),
    ]
    expect(getElementAtPoint(rects, 10, 10)?.id).toBe("b")
  })

  test("excludes overlay rects", () => {
    const rects = [rect({ id: "a" }), rect({ id: "b", isOverlay: true, zIndex: 9 })]
    expect(getElementAtPoint(rects, 10, 10)?.id).toBe("a")
  })

  test("zero-size elements filtered", () => {
    const rects = [rect({ id: "empty", w: 0, h: 0 })]
    expect(getElementAtPoint(rects, 10, 10)).toBeNull()
  })

  test("display:none filtered", () => {
    const rects = [rect({ id: "hidden", display: "none" })]
    expect(getElementAtPoint(rects, 10, 10)).toBeNull()
  })

  test("position threshold returns cached result", () => {
    const s = createPickerState()
    const rects = [rect({ id: "a" })]
    getElementAtPoint(rects, 10, 10, s)
    const cached = getElementAtPoint([], 11, 11, s) // empty rects; cache still applies
    expect(cached?.id).toBe("a")
  })

  test("invalidatePositionCache forces recomputation", () => {
    const s = createPickerState()
    const rects = [rect({ id: "a" })]
    getElementAtPoint(rects, 10, 10, s)
    invalidatePositionCache(s)
    expect(getElementAtPoint([], 11, 11, s)).toBeNull()
  })

  test("rectContains bounds are half-open", () => {
    const r = rect()
    expect(rectContains(r, 0, 0)).toBe(true)
    expect(rectContains(r, 100, 0)).toBe(false)
  })

  test("isVisible false for visibility:hidden", () => {
    expect(isVisible(rect({ visibility: "hidden" }))).toBe(false)
  })
})

describe("overlay canvas + lerp", () => {
  test("canvas scales with devicePixelRatio", () => {
    const d = canvasDimensions({
      canvasWidth: 100,
      canvasHeight: 50,
      devicePixelRatio: 2,
      borderRadius: 0,
    })
    expect(d.width).toBe(200)
    expect(d.height).toBe(100)
  })

  test("lerp clamps t to [0,1]", () => {
    expect(lerp(0, 10, -1)).toBe(0)
    expect(lerp(0, 10, 2)).toBe(10)
    expect(lerp(0, 10, 0.5)).toBe(5)
  })

  test("interpolateFrame midway", () => {
    const out = interpolateFrame(
      { x: 0, y: 0, w: 100, h: 50, borderRadius: 0 },
      { x: 10, y: 20, w: 200, h: 100, borderRadius: 8 },
      0.5,
    )
    expect(out).toEqual({ x: 5, y: 10, w: 150, h: 75, borderRadius: 4 })
  })

  test("isOverlayId matches __coda_inspector_ prefix", () => {
    expect(isOverlayId("__coda_inspector_rect")).toBe(true)
    expect(isOverlayId("div")).toBe(false)
  })

  test("filterOutOverlay drops overlay rects", () => {
    const rects = [{ id: "a" }, { id: "__coda_inspector_canvas" }, { id: "b" }]
    expect(filterOutOverlay(rects).map((n) => n.id)).toEqual(["a", "b"])
  })
})

describe("css-baseline diff", () => {
  test("authored color:red diffs against baseline default", () => {
    const baseline = new MemoryBaseline()
    baseline.set("div", { color: "rgb(0,0,0)", display: "block" })
    const out = diffAgainstBaseline("div", { color: "rgb(255,0,0)", display: "block" }, baseline)
    expect(out).toEqual({ color: "rgb(255,0,0)" })
  })

  test("same as baseline returns empty diff", () => {
    const baseline = new MemoryBaseline()
    baseline.set("div", { display: "block" })
    expect(diffAgainstBaseline("div", { display: "block" }, baseline)).toEqual({})
  })

  test("unknown tag uses empty baseline (all authored)", () => {
    const baseline = new MemoryBaseline()
    const out = diffAgainstBaseline("custom-el", { color: "red" }, baseline)
    expect(out).toEqual({ color: "red" })
  })

  test("filterTrackedProps keeps tracked only", () => {
    const out = filterTrackedProps({
      color: "red",
      "--my-var": "1",
      "font-size": "14px",
    })
    expect(out).toEqual({ color: "red", "font-size": "14px" })
  })
})
