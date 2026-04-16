import { describe, expect, test } from "bun:test"
import { parsePorcelain, summarize } from "./status"

describe("parsePorcelain", () => {
  test("parses basic modifications", () => {
    const out = parsePorcelain(" M src/a.ts\nM  src/b.ts\nA  src/c.ts\n?? src/d.ts")
    expect(out).toHaveLength(4)
    expect(out[0]).toMatchObject({ path: "src/a.ts", worktree: "modified", index: "unmodified" })
    expect(out[1]).toMatchObject({ path: "src/b.ts", index: "modified" })
    expect(out[2]).toMatchObject({ path: "src/c.ts", index: "added" })
    expect(out[3]).toMatchObject({ path: "src/d.ts", index: "untracked", worktree: "untracked" })
  })

  test("parses rename with arrow", () => {
    const out = parsePorcelain("R  old/name.ts -> new/name.ts")
    expect(out[0]).toEqual({
      path: "new/name.ts",
      origPath: "old/name.ts",
      index: "renamed",
      worktree: "unmodified",
      conflict: false,
    })
  })

  test("detects conflict (UU)", () => {
    const out = parsePorcelain("UU conflict.ts")
    expect(out[0]?.conflict).toBe(true)
  })

  test("detects AA as both-added conflict", () => {
    const out = parsePorcelain("AA both-added.ts")
    expect(out[0]?.conflict).toBe(true)
  })

  test("ignores truncated / malformed lines", () => {
    expect(parsePorcelain("  \n")).toEqual([])
  })
})

describe("summarize", () => {
  test("counts correctly", () => {
    const out = summarize([
      { path: "a", index: "modified", worktree: "unmodified", conflict: false },
      { path: "b", index: "unmodified", worktree: "modified", conflict: false },
      { path: "c", index: "untracked", worktree: "untracked", conflict: false },
      { path: "d", index: "conflict", worktree: "unmodified", conflict: true },
    ])
    expect(out).toEqual({ staged: 1, modified: 1, untracked: 1, conflicts: 1, total: 4 })
  })
})
