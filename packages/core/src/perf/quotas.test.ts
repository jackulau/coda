import { describe, expect, test } from "bun:test"
import { recommendedActions, shouldShed, tierFromAvailable } from "./quotas"

describe("tierFromAvailable", () => {
  test("plenty of memory → comfortable, no shedding", () => {
    expect(tierFromAvailable(8000).name).toBe("comfortable")
    expect(recommendedActions(8000)).toEqual([])
  })

  test("≤ 800 MB → elevated trims caches", () => {
    expect(tierFromAvailable(700).name).toBe("elevated")
    expect(recommendedActions(700)).toContain("trim-pr-cache")
  })

  test("≤ 400 MB → pressure adds force-gc and tab close", () => {
    expect(tierFromAvailable(300).name).toBe("pressure")
    expect(recommendedActions(300)).toContain("close-background-browser-tabs")
    expect(recommendedActions(300)).toContain("force-gc-hint")
  })

  test("≤ 200 MB → critical drops undo + evicts pty", () => {
    expect(tierFromAvailable(150).name).toBe("critical")
    expect(recommendedActions(150)).toContain("drop-undo-stacks")
    expect(recommendedActions(150)).toContain("evict-inactive-pty-buffers")
  })
})

describe("shouldShed", () => {
  test("returns false at comfortable level", () => {
    expect(shouldShed(8000, "trim-pr-cache")).toBe(false)
  })
  test("returns true at elevated for cache trim", () => {
    expect(shouldShed(700, "trim-pr-cache")).toBe(true)
    expect(shouldShed(700, "drop-undo-stacks")).toBe(false)
  })
  test("returns true at critical for everything in the ladder", () => {
    expect(shouldShed(100, "drop-undo-stacks")).toBe(true)
    expect(shouldShed(100, "evict-inactive-pty-buffers")).toBe(true)
  })
})
