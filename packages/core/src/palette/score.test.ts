import { describe, expect, test } from "bun:test"
import { fuzzyScore, rank } from "./score"

describe("fuzzyScore", () => {
  test("empty needle scores 0", () => {
    expect(fuzzyScore("anything", "")).toBe(0)
  })

  test("non-subsequence returns -1", () => {
    expect(fuzzyScore("hello", "xyz")).toBe(-1)
  })

  test("exact prefix beats subsequence", () => {
    expect(fuzzyScore("foobar", "foo")).toBeGreaterThan(fuzzyScore("zfoo", "foo"))
  })

  test("consecutive matches beat scattered", () => {
    expect(fuzzyScore("openworkspace", "open")).toBeGreaterThan(
      fuzzyScore("o-p-e-n-workspace", "open"),
    )
  })

  test("word-start matches boost score", () => {
    const score = fuzzyScore("git-log-show", "gls")
    expect(score).toBeGreaterThan(0)
  })

  test("case-insensitive by default", () => {
    expect(fuzzyScore("FOOBAR", "foo")).toBeGreaterThan(0)
  })

  test("case-sensitive mode rejects mismatched case", () => {
    expect(fuzzyScore("FOOBAR", "foo", { caseSensitive: true })).toBe(-1)
  })
})

describe("rank", () => {
  const items = [
    "open file",
    "open recent workspace",
    "close other workspaces",
    "git pull",
    "open workspace settings",
    "preferences open palette",
  ]

  test("empty needle returns all items in original order", () => {
    const out = rank(items, "", (s) => s)
    expect(out.map((i) => i.item)).toEqual(items)
  })

  test("matches ranked by score desc", () => {
    const out = rank(items, "open", (s) => s)
    expect(out[0]?.item).toBe("open file")
    expect(out.map((i) => i.item)).toContain("open recent workspace")
  })

  test("non-matches excluded", () => {
    const out = rank(items, "xyz", (s) => s)
    expect(out).toEqual([])
  })

  test("matches array contains positions of needle chars", () => {
    const out = rank(["abcdef"], "ace", (s) => s)
    expect(out[0]?.matches).toEqual([0, 2, 4])
  })

  test("name tiebreak when scores equal", () => {
    const out = rank(["apple", "amber", "anchor"], "a", (s) => s)
    const names = out.map((i) => i.item)
    expect(names).toEqual(names.slice().sort())
  })
})
