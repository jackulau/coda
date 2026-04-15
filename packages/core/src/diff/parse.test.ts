import { describe, expect, test } from "bun:test"
import { parseDiffFile } from "./parse"

const SAMPLE = `--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,4 +1,5 @@ function foo() {
 const a = 1
-const b = 2
+const b = 3
+const c = 4
 const d = 5
`

describe("parseDiffFile", () => {
  test("parses paths from --- / +++", () => {
    const out = parseDiffFile(SAMPLE)
    expect(out.oldPath).toBe("src/foo.ts")
    expect(out.newPath).toBe("src/foo.ts")
  })

  test("counts additions and deletions", () => {
    const out = parseDiffFile(SAMPLE)
    expect(out.additions).toBe(2)
    expect(out.deletions).toBe(1)
  })

  test("hunk header parsed correctly", () => {
    const out = parseDiffFile(SAMPLE)
    expect(out.hunks).toHaveLength(1)
    const h = out.hunks[0]
    expect(h?.oldStart).toBe(1)
    expect(h?.oldLines).toBe(4)
    expect(h?.newStart).toBe(1)
    expect(h?.newLines).toBe(5)
    expect(h?.header).toBe("function foo() {")
  })

  test("line kinds and numbers correct", () => {
    const out = parseDiffFile(SAMPLE)
    const lines = out.hunks[0]?.lines ?? []
    expect(lines.map((l) => l.kind)).toEqual(["context", "remove", "add", "add", "context"])
    expect(lines[0]?.oldLine).toBe(1)
    expect(lines[0]?.newLine).toBe(1)
    expect(lines[1]?.oldLine).toBe(2)
    expect(lines[2]?.newLine).toBe(2)
  })

  test("/dev/null paths represent add/delete", () => {
    const out = parseDiffFile(`--- /dev/null
+++ b/new.ts
@@ -0,0 +1,1 @@
+x
`)
    expect(out.oldPath).toBe(null)
    expect(out.newPath).toBe("new.ts")
    expect(out.additions).toBe(1)
  })

  test("'No newline at end of file' marker is ignored", () => {
    const out = parseDiffFile(`--- a/x
+++ b/x
@@ -1,1 +1,1 @@
-old
+new
\\ No newline at end of file
`)
    expect(out.additions).toBe(1)
    expect(out.deletions).toBe(1)
  })

  test("multi-hunk file accumulates totals", () => {
    const patch = `--- a/x
+++ b/x
@@ -1,2 +1,2 @@
-a
+b
@@ -10,2 +10,3 @@
 c
+d
`
    const out = parseDiffFile(patch)
    expect(out.hunks).toHaveLength(2)
    expect(out.additions).toBe(2)
    expect(out.deletions).toBe(1)
  })

  test("empty patch returns empty result", () => {
    const out = parseDiffFile("")
    expect(out.hunks).toHaveLength(0)
    expect(out.additions).toBe(0)
    expect(out.deletions).toBe(0)
  })
})
