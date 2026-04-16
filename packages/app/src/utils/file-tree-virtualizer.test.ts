import { describe, expect, test } from "bun:test"
import { computeWindow } from "./file-tree-virtualizer"

describe("file-tree virtualizer (D1)", () => {
  test("empty tree yields an empty window", () => {
    const w = computeWindow(0, 24, 400, 0)
    expect(w.startIndex).toBe(0)
    expect(w.endIndex).toBe(0)
  })

  test("scrolled to top shows first rows plus overscan", () => {
    const w = computeWindow(1000, 24, 480, 0, 5)
    expect(w.startIndex).toBe(0)
    expect(w.endIndex).toBeGreaterThan(0)
    expect(w.offsetY).toBe(0)
  })

  test("scrolled past middle offsets the window", () => {
    const w = computeWindow(1000, 24, 480, 2400, 5)
    expect(w.startIndex).toBeGreaterThan(90)
    expect(w.offsetY).toBe(w.startIndex * 24)
  })

  test("scrolled to end clamps endIndex to totalRows", () => {
    const w = computeWindow(100, 24, 480, 10_000, 5)
    expect(w.endIndex).toBeLessThanOrEqual(100)
  })

  test("overscan is applied to both sides", () => {
    const w = computeWindow(1000, 24, 240, 480, 3)
    const visibleRange = 240 / 24
    expect(w.endIndex - w.startIndex).toBeGreaterThan(visibleRange)
  })
})
