export interface Range {
  startLine: number
  startColumn: number
  endLine: number
  endColumn: number
}

export interface Edit {
  range: Range
  insertText: string
}

export class EditorBuffer {
  private lines: string[]
  private revision = 0
  private dirty = false

  constructor(initial: string) {
    this.lines = initial.split("\n")
  }

  text(): string {
    return this.lines.join("\n")
  }

  lineCount(): number {
    return this.lines.length
  }

  lineAt(lineNumber: number): string | undefined {
    return this.lines[lineNumber - 1]
  }

  revisionNumber(): number {
    return this.revision
  }

  isDirty(): boolean {
    return this.dirty
  }

  markSaved(): void {
    this.dirty = false
  }

  applyEdit(edit: Edit): void {
    const r = normalizeRange(edit.range)
    if (r.startLine < 1 || r.endLine < 1) throw new Error("line numbers are 1-based")
    if (r.startLine > this.lines.length || r.endLine > this.lines.length) {
      throw new Error("range out of bounds")
    }

    const before = this.lines.slice(0, r.startLine - 1)
    const firstLine = this.lines[r.startLine - 1] ?? ""
    const prefix = firstLine.slice(0, r.startColumn - 1)
    const lastLine = this.lines[r.endLine - 1] ?? ""
    const suffix = lastLine.slice(r.endColumn - 1)
    const inserted = edit.insertText.split("\n")
    const merged: string[] = []
    if (inserted.length === 1) {
      merged.push(`${prefix}${inserted[0] ?? ""}${suffix}`)
    } else {
      merged.push(`${prefix}${inserted[0] ?? ""}`)
      for (let i = 1; i < inserted.length - 1; i++) merged.push(inserted[i] ?? "")
      merged.push(`${inserted[inserted.length - 1] ?? ""}${suffix}`)
    }
    const after = this.lines.slice(r.endLine)
    this.lines = [...before, ...merged, ...after]
    this.revision++
    this.dirty = true
  }

  applyMany(edits: Edit[]): void {
    const sorted = [...edits].sort((a, b) => {
      if (a.range.startLine !== b.range.startLine) return b.range.startLine - a.range.startLine
      return b.range.startColumn - a.range.startColumn
    })
    for (const e of sorted) this.applyEdit(e)
  }
}

function normalizeRange(r: Range): Range {
  if (r.startLine > r.endLine || (r.startLine === r.endLine && r.startColumn > r.endColumn)) {
    return {
      startLine: r.endLine,
      startColumn: r.endColumn,
      endLine: r.startLine,
      endColumn: r.startColumn,
    }
  }
  return r
}

export function rangeLength(text: string, range: Range): number {
  return text.slice(
    offsetOf(text, range.startLine, range.startColumn),
    offsetOf(text, range.endLine, range.endColumn),
  ).length
}

function offsetOf(text: string, line: number, col: number): number {
  let offset = 0
  let currentLine = 1
  for (let i = 0; i < text.length; i++) {
    if (currentLine === line) {
      return offset + (col - 1)
    }
    if (text[i] === "\n") currentLine++
    offset++
  }
  return offset
}
