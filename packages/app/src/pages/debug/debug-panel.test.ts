import { describe, expect, test } from "bun:test"
import { filterByLevel } from "./debug-panel"

describe("debug panel (Y2)", () => {
  test("filterByLevel keeps only lines whose level is allowed", () => {
    const lines = [
      { level: "info", message: "hi", ts: 1 },
      { level: "error", message: "oops", ts: 2 },
      { level: "debug", message: "noise", ts: 3 },
    ]
    expect(filterByLevel(lines, ["error"]).length).toBe(1)
    expect(filterByLevel(lines, ["info", "error"]).length).toBe(2)
  })

  test("empty allowed returns empty", () => {
    expect(filterByLevel([{ level: "info", message: "a", ts: 0 }], [])).toEqual([])
  })
})
