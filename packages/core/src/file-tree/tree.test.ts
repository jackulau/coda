import { describe, expect, test } from "bun:test"
import { type FileNode, filterNodes, flattenTree } from "./tree"

const f = (path: string, kind: "file" | "directory" = "file"): FileNode => ({
  path,
  name: path.split("/").pop() ?? "",
  kind,
})

describe("flattenTree", () => {
  test("collapsed root shows only top-level", () => {
    const entries = [f("/r/src", "directory"), f("/r/src/a.ts"), f("/r/README.md")]
    const out = flattenTree(entries, { expandedPaths: new Set(), rootPath: "/r" })
    expect(out.map((n) => n.path)).toEqual(["/r/src", "/r/README.md"])
  })

  test("directories sort before files at same level", () => {
    const entries = [f("/r/zfile"), f("/r/adir", "directory"), f("/r/bfile")]
    const out = flattenTree(entries, { expandedPaths: new Set(), rootPath: "/r" })
    expect(out.map((n) => n.name)).toEqual(["adir", "bfile", "zfile"])
  })

  test("expanded dirs show children at depth+1", () => {
    const entries = [f("/r/src", "directory"), f("/r/src/a.ts"), f("/r/src/b.ts")]
    const out = flattenTree(entries, {
      expandedPaths: new Set(["/r/src"]),
      rootPath: "/r",
    })
    expect(out.map((n) => ({ p: n.path, d: n.depth }))).toEqual([
      { p: "/r/src", d: 0 },
      { p: "/r/src/a.ts", d: 1 },
      { p: "/r/src/b.ts", d: 1 },
    ])
  })

  test("hasChildren flag correct", () => {
    const entries = [f("/r/empty", "directory"), f("/r/full", "directory"), f("/r/full/x")]
    const out = flattenTree(entries, { expandedPaths: new Set(), rootPath: "/r" })
    expect(out.find((n) => n.path === "/r/empty")?.hasChildren).toBe(false)
    expect(out.find((n) => n.path === "/r/full")?.hasChildren).toBe(true)
  })
})

describe("filterNodes", () => {
  const entries = [
    f("/r/src", "directory"),
    f("/r/src/foo.ts"),
    f("/r/src/bar.ts"),
    f("/r/README.md"),
  ]
  test("empty query returns everything", () => {
    expect(filterNodes(entries, { query: "" }).length).toBe(entries.length)
  })
  test("matches by substring (case-insensitive default)", () => {
    const out = filterNodes(entries, { query: "FOO" })
    expect(out.map((e) => e.path)).toContain("/r/src/foo.ts")
  })
  test("case-sensitive rejects mismatched case", () => {
    const out = filterNodes(entries, { query: "FOO", caseSensitive: true })
    expect(out.map((e) => e.path)).not.toContain("/r/src/foo.ts")
  })
})
