import { describe, expect, test } from "bun:test"
import { fuzzyScore, rank } from "@coda/core/palette/score"

describe("command-palette fuzzy filter (U2)", () => {
  test("exact prefix match beats midpoint match", () => {
    const prefix = fuzzyScore("open file", "open")
    const middle = fuzzyScore("close that open thing", "open")
    expect(prefix).toBeGreaterThan(middle)
  })

  test("unrelated query yields a negative score", () => {
    expect(fuzzyScore("foo", "xyz")).toBeLessThan(0)
  })

  test("rank() sorts by descending score", () => {
    const items = [
      { id: "1", label: "open file" },
      { id: "2", label: "close file" },
      { id: "3", label: "open port" },
    ]
    const ordered = rank(items, "open", (i) => i.label)
    expect(ordered[0]?.item.id).not.toBe("2")
  })
})
