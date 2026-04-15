export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  header: string
  lines: DiffLine[]
}

export type DiffLineKind = "context" | "add" | "remove"

export interface DiffLine {
  kind: DiffLineKind
  oldLine?: number
  newLine?: number
  text: string
}

export interface ParsedDiffFile {
  oldPath: string | null
  newPath: string | null
  hunks: DiffHunk[]
  additions: number
  deletions: number
}

const HUNK_HEADER = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/

export function parseDiffFile(
  patch: string,
  paths: { oldPath?: string; newPath?: string } = {},
): ParsedDiffFile {
  const lines = patch.split("\n")
  let oldPath: string | null = paths.oldPath ?? null
  let newPath: string | null = paths.newPath ?? null
  const hunks: DiffHunk[] = []
  let cur: DiffHunk | null = null
  let oldCursor = 0
  let newCursor = 0
  let additions = 0
  let deletions = 0

  for (const raw of lines) {
    if (raw.startsWith("--- ")) {
      const p = raw.slice(4).trim()
      oldPath = p === "/dev/null" ? null : stripPrefix(p)
      continue
    }
    if (raw.startsWith("+++ ")) {
      const p = raw.slice(4).trim()
      newPath = p === "/dev/null" ? null : stripPrefix(p)
      continue
    }
    const hm = HUNK_HEADER.exec(raw)
    if (hm) {
      cur = {
        oldStart: Number.parseInt(hm[1] ?? "0", 10),
        oldLines: Number.parseInt(hm[2] ?? "1", 10),
        newStart: Number.parseInt(hm[3] ?? "0", 10),
        newLines: Number.parseInt(hm[4] ?? "1", 10),
        header: hm[5]?.trim() ?? "",
        lines: [],
      }
      hunks.push(cur)
      oldCursor = cur.oldStart
      newCursor = cur.newStart
      continue
    }
    if (!cur) continue
    if (raw.startsWith("+")) {
      cur.lines.push({ kind: "add", newLine: newCursor, text: raw.slice(1) })
      additions++
      newCursor++
    } else if (raw.startsWith("-")) {
      cur.lines.push({ kind: "remove", oldLine: oldCursor, text: raw.slice(1) })
      deletions++
      oldCursor++
    } else if (raw.startsWith(" ")) {
      cur.lines.push({
        kind: "context",
        oldLine: oldCursor,
        newLine: newCursor,
        text: raw.slice(1),
      })
      oldCursor++
      newCursor++
    } else if (raw === "" || raw.startsWith("\\ No newline")) {
      // skip
    }
  }

  return { oldPath, newPath, hunks, additions, deletions }
}

function stripPrefix(p: string): string {
  if (p.startsWith("a/") || p.startsWith("b/")) return p.slice(2)
  return p
}
