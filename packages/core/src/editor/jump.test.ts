import { describe, expect, test } from "bun:test"
import type { DiffHunk } from "../diff/parse"
import { jumpToDiffHunk, jumpToDiffHunkOldSide } from "./jump"

const hunk: DiffHunk = {
  oldStart: 10,
  oldLines: 3,
  newStart: 10,
  newLines: 4,
  header: "",
  lines: [
    { kind: "context", oldLine: 10, newLine: 10, text: " a" },
    { kind: "remove", oldLine: 11, text: "-b" },
    { kind: "add", newLine: 11, text: "+B" },
    { kind: "add", newLine: 12, text: "+new-line" },
    { kind: "context", oldLine: 12, newLine: 13, text: " c" },
  ],
}

describe("jumpToDiffHunk", () => {
  test("targets the first added line (new side)", () => {
    const t = jumpToDiffHunk(hunk)
    expect(t.line).toBe(11)
    expect(t.highlightLines).toEqual([11, 12])
  })

  test("falls back to newStart when no additions", () => {
    const noAdds: DiffHunk = {
      ...hunk,
      lines: [{ kind: "context", oldLine: 10, newLine: 10, text: " ok" }],
    }
    expect(jumpToDiffHunk(noAdds).line).toBe(10)
  })
})

describe("jumpToDiffHunkOldSide", () => {
  test("targets first removed line (old side)", () => {
    const t = jumpToDiffHunkOldSide(hunk)
    expect(t.line).toBe(11)
    expect(t.highlightLines).toEqual([11])
  })
})
