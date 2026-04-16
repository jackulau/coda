import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { diff, snapshot } from "./verify-idempotent"

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "verify-idempotent-"))
  try {
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe("snapshot", () => {
  test("hashes file contents", () => {
    withTempDir((dir) => {
      const a = join(dir, "a.txt")
      writeFileSync(a, "hello")
      const snap = snapshot([a], "")
      expect(snap.treeHashes[a]).toBeTruthy()
      expect(snap.treeHashes[a]).not.toBe("missing")
    })
  })

  test("missing file recorded as 'missing'", () => {
    const snap = snapshot(["/nonexistent/file.txt"], "")
    expect(snap.treeHashes["/nonexistent/file.txt"]).toBe("missing")
  })

  test("uses provided git status verbatim", () => {
    const snap = snapshot([], "M packages/core/src/index.ts\n")
    expect(snap.gitStatus).toBe("M packages/core/src/index.ts\n")
  })
})

describe("diff", () => {
  test("identical snapshots → empty diff", () => {
    const a = snapshot([], "")
    const b = snapshot([], "")
    expect(diff(a, b)).toEqual([])
  })

  test("different git status flagged", () => {
    const a = { gitStatus: "clean", treeHashes: {} }
    const b = { gitStatus: "dirty", treeHashes: {} }
    expect(diff(a, b)).toContain("git status changed between runs")
  })

  test("file hash change flagged with before → after", () => {
    const a = { gitStatus: "", treeHashes: { "x.ts": "aaa" } }
    const b = { gitStatus: "", treeHashes: { "x.ts": "bbb" } }
    const diffs = diff(a, b)
    expect(diffs[0]).toContain("x.ts")
    expect(diffs[0]).toContain("aaa")
    expect(diffs[0]).toContain("bbb")
  })

  test("file appearing across runs flagged", () => {
    const a = { gitStatus: "", treeHashes: {} }
    const b = { gitStatus: "", treeHashes: { "new.ts": "hash" } }
    expect(diff(a, b).length).toBe(1)
  })

  test("deterministic file-edit task: two identical snapshots pass", () => {
    withTempDir((dir) => {
      const f = join(dir, "out.ts")
      writeFileSync(f, "export const x = 1\n")
      const s1 = snapshot([f], "")
      const s2 = snapshot([f], "")
      expect(diff(s1, s2)).toEqual([])
    })
  })

  test("task that appends uncontrolled lines fails", () => {
    withTempDir((dir) => {
      const f = join(dir, "log.ts")
      writeFileSync(f, "run-1\n")
      const s1 = snapshot([f], "")
      writeFileSync(f, "run-1\nrun-2\n")
      const s2 = snapshot([f], "")
      expect(diff(s1, s2).length).toBeGreaterThan(0)
    })
  })

  test("task that writes timestamps fails with actionable diff", () => {
    withTempDir((dir) => {
      const f = join(dir, "stamp.ts")
      writeFileSync(f, `export const t = ${Date.now()}\n`)
      const s1 = snapshot([f], "")
      writeFileSync(f, `export const t = ${Date.now() + 1}\n`)
      const s2 = snapshot([f], "")
      const diffs = diff(s1, s2)
      expect(diffs.length).toBe(1)
      expect(diffs[0]).toContain("stamp.ts")
    })
  })
})
