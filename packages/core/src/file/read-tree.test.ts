import { describe, expect, test } from "bun:test"
import { type FileNode, flattenTree } from "../file-tree/tree"

function f(path: string, kind: "file" | "directory" = "file"): FileNode {
  return { path, name: path.split("/").pop() ?? "", kind }
}

describe("read-tree flattening + sorting (D1)", () => {
  test("directories sort before files, alphabetically within each", () => {
    const entries: FileNode[] = [
      f("/root/a.ts"),
      f("/root/z-dir", "directory"),
      f("/root/b.ts"),
      f("/root/a-dir", "directory"),
    ]
    const out = flattenTree(entries, { rootPath: "/root", expandedPaths: new Set() })
    // directories first (sorted), then files (sorted) — all lowercase so locale ordering is stable
    expect(out.map((n) => n.kind)).toEqual(["directory", "directory", "file", "file"])
    expect(out[0]?.name).toBe("a-dir")
    expect(out[1]?.name).toBe("z-dir")
    expect(out[2]?.name).toBe("a.ts")
    expect(out[3]?.name).toBe("b.ts")
  })

  test("expanded directory shows children at depth+1", () => {
    const entries: FileNode[] = [
      f("/root/src", "directory"),
      f("/root/src/index.ts"),
      f("/root/src/util.ts"),
    ]
    const out = flattenTree(entries, {
      rootPath: "/root",
      expandedPaths: new Set(["/root/src"]),
    })
    expect(out.map((n) => n.depth)).toEqual([0, 1, 1])
  })

  test("collapsed directory hides children", () => {
    const entries: FileNode[] = [
      f("/root/src", "directory"),
      f("/root/src/index.ts"),
    ]
    const out = flattenTree(entries, { rootPath: "/root", expandedPaths: new Set() })
    expect(out.length).toBe(1)
    expect(out[0]?.path).toBe("/root/src")
  })

  test("empty entries yields empty output", () => {
    expect(flattenTree([], { rootPath: "/root", expandedPaths: new Set() })).toEqual([])
  })
})
