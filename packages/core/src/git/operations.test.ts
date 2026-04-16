import { describe, expect, test } from "bun:test"
import { parsePorcelain } from "./status"

describe("git operations — parsePorcelain (I3)", () => {
  test("parses a modified+untracked mix", () => {
    const stdout = [" M src/a.ts", "?? build/", "M  src/b.ts", "R  old.ts -> new.ts"].join("\n")
    const rows = parsePorcelain(stdout)
    expect(rows.length).toBe(4)
    expect(rows.find((r) => r.path === "src/a.ts")?.worktree).toBe("modified")
    expect(rows.find((r) => r.path === "build/")?.worktree).toBe("untracked")
    expect(rows.find((r) => r.path === "src/b.ts")?.index).toBe("modified")
    const renamed = rows.find((r) => r.path === "new.ts")
    expect(renamed?.origPath).toBe("old.ts")
  })

  test("conflict flag set on U entries", () => {
    const stdout = "UU merge.ts"
    const rows = parsePorcelain(stdout)
    expect(rows[0]?.conflict).toBe(true)
  })

  test("empty input yields empty output", () => {
    expect(parsePorcelain("")).toEqual([])
  })

  test("ignores ignored files (prefix '!!')", () => {
    const stdout = "!! .env\n M real.ts"
    const rows = parsePorcelain(stdout)
    const ignored = rows.find((r) => r.path === ".env")
    expect(ignored?.worktree).toBe("ignored")
    const real = rows.find((r) => r.path === "real.ts")
    expect(real?.worktree).toBe("modified")
  })
})
