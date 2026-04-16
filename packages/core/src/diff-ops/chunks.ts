export interface DiffLine {
  kind: "context" | "added" | "removed"
  text: string
}

export interface DiffChunk {
  id: string
  startA: number
  endA: number
  startB: number
  endB: number
  lines: DiffLine[]
}

export interface ChunkApplyResult {
  chunkId: string
  kind: "accepted" | "rejected"
  resultLines: string[]
}

export function acceptChunk(baseLines: string[], chunk: DiffChunk): ChunkApplyResult {
  const before = baseLines.slice(0, chunk.startA)
  const after = baseLines.slice(chunk.endA)
  const replaced = chunk.lines.filter((l) => l.kind !== "removed").map((l) => l.text)
  return {
    chunkId: chunk.id,
    kind: "accepted",
    resultLines: [...before, ...replaced, ...after],
  }
}

export function rejectChunk(baseLines: string[], chunk: DiffChunk): ChunkApplyResult {
  const before = baseLines.slice(0, chunk.startA)
  const after = baseLines.slice(chunk.endA)
  const kept = chunk.lines.filter((l) => l.kind !== "added").map((l) => l.text)
  return {
    chunkId: chunk.id,
    kind: "rejected",
    resultLines: [...before, ...kept, ...after],
  }
}

export interface CollapseOptions {
  context?: number
  min?: number
}

export interface CollapseRange {
  startLine: number
  endLine: number
  hiddenCount: number
}

export function computeCollapseRanges(
  lines: DiffLine[],
  opts: CollapseOptions = {},
): CollapseRange[] {
  const context = opts.context ?? 3
  const min = opts.min ?? 4
  const out: CollapseRange[] = []
  let runStart = -1
  let runCount = 0
  for (let i = 0; i <= lines.length; i++) {
    const isCtx = i < lines.length && lines[i]?.kind === "context"
    if (isCtx) {
      if (runStart === -1) runStart = i
      runCount += 1
    } else if (runStart !== -1) {
      const effective = runCount - 2 * context
      if (effective >= min) {
        out.push({
          startLine: runStart + context,
          endLine: runStart + runCount - context - 1,
          hiddenCount: effective,
        })
      }
      runStart = -1
      runCount = 0
    }
  }
  return out
}

export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript"
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript"
    case "py":
      return "python"
    case "rs":
      return "rust"
    case "go":
      return "go"
    case "md":
      return "markdown"
    case "json":
      return "json"
    case "css":
      return "css"
    case "html":
      return "html"
    default:
      return "plaintext"
  }
}

export type DiffMode = "unified" | "split"

export function toggleMode(cur: DiffMode): DiffMode {
  return cur === "unified" ? "split" : "unified"
}
