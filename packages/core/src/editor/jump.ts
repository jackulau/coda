import type { DiffHunk } from "../diff/parse"

export interface JumpTarget {
  line: number
  column: number
  highlightLines: number[]
}

export function jumpToDiffHunk(hunk: DiffHunk): JumpTarget {
  const firstAdd = hunk.lines.find((l) => l.kind === "add")
  const line = firstAdd?.newLine ?? hunk.newStart
  const highlightLines: number[] = []
  for (const l of hunk.lines) {
    if (l.kind === "add" && l.newLine !== undefined) highlightLines.push(l.newLine)
  }
  return { line, column: 1, highlightLines }
}

export function jumpToDiffHunkOldSide(hunk: DiffHunk): JumpTarget {
  const firstDel = hunk.lines.find((l) => l.kind === "remove")
  const line = firstDel?.oldLine ?? hunk.oldStart
  const highlightLines: number[] = []
  for (const l of hunk.lines) {
    if (l.kind === "remove" && l.oldLine !== undefined) highlightLines.push(l.oldLine)
  }
  return { line, column: 1, highlightLines }
}
