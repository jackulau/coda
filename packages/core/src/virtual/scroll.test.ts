import { describe, expect, test } from "bun:test"
import { computeWindow } from "./scroll"

describe("computeWindow", () => {
  test("scrollTop=0 returns first page + overscan", () => {
    const w = computeWindow({
      scrollTop: 0,
      viewportHeight: 400,
      rowHeight: 40,
      itemCount: 1000,
      overscan: 4,
    })
    expect(w.start).toBe(0)
    expect(w.end).toBe(14)
    expect(w.offsetY).toBe(0)
    expect(w.visibleCount).toBe(14)
    expect(w.totalHeight).toBe(40_000)
  })

  test("mid scroll centers window around scrollTop", () => {
    const w = computeWindow({
      scrollTop: 2000,
      viewportHeight: 400,
      rowHeight: 40,
      itemCount: 1000,
      overscan: 4,
    })
    expect(w.start).toBe(46)
    expect(w.end).toBe(64)
    expect(w.offsetY).toBe(46 * 40)
  })

  test("end of list clamps to itemCount", () => {
    const w = computeWindow({
      scrollTop: 50_000,
      viewportHeight: 400,
      rowHeight: 40,
      itemCount: 100,
    })
    expect(w.end).toBe(100)
    expect(w.start).toBeLessThanOrEqual(100)
    expect(w.visibleCount).toBeGreaterThanOrEqual(0)
  })

  test("negative scrollTop clamps to 0", () => {
    const w = computeWindow({
      scrollTop: -100,
      viewportHeight: 400,
      rowHeight: 40,
      itemCount: 1000,
    })
    expect(w.start).toBe(0)
  })

  test("empty list yields empty window", () => {
    const w = computeWindow({
      scrollTop: 0,
      viewportHeight: 400,
      rowHeight: 40,
      itemCount: 0,
    })
    expect(w.visibleCount).toBe(0)
    expect(w.totalHeight).toBe(0)
  })

  test("rowHeight<=0 throws", () => {
    expect(() =>
      computeWindow({
        scrollTop: 0,
        viewportHeight: 400,
        rowHeight: 0,
        itemCount: 10,
      }),
    ).toThrow()
  })
})
