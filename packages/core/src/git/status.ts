export type GitStatusKind =
  | "unmodified"
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "ignored"
  | "conflict"

export interface GitFileStatus {
  path: string
  origPath?: string
  index: GitStatusKind
  worktree: GitStatusKind
  conflict: boolean
}

const CODE: Record<string, GitStatusKind> = {
  " ": "unmodified",
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  "?": "untracked",
  "!": "ignored",
  U: "conflict",
}

export function parsePorcelain(stdout: string): GitFileStatus[] {
  const out: GitFileStatus[] = []
  const lines = stdout.split("\n")
  for (const line of lines) {
    if (line.length < 3) continue
    const x = line[0] ?? " "
    const y = line[1] ?? " "
    const rest = line.slice(3)

    const indexK = CODE[x] ?? "unmodified"
    const worktreeK = CODE[y] ?? "unmodified"
    const conflict =
      indexK === "conflict" ||
      worktreeK === "conflict" ||
      (x === "A" && y === "A") ||
      (x === "D" && y === "D")

    if (indexK === "renamed" || indexK === "copied") {
      const arrowIdx = rest.indexOf(" -> ")
      if (arrowIdx >= 0) {
        out.push({
          path: rest.slice(arrowIdx + 4),
          origPath: rest.slice(0, arrowIdx),
          index: indexK,
          worktree: worktreeK,
          conflict,
        })
        continue
      }
    }

    out.push({ path: rest, index: indexK, worktree: worktreeK, conflict })
  }
  return out
}

export interface GitStatusSummary {
  staged: number
  modified: number
  untracked: number
  conflicts: number
  total: number
}

export function summarize(files: GitFileStatus[]): GitStatusSummary {
  let staged = 0
  let modified = 0
  let untracked = 0
  let conflicts = 0
  for (const f of files) {
    if (f.conflict) {
      conflicts++
      continue
    }
    if (f.index === "untracked" || f.worktree === "untracked") untracked++
    else if (f.worktree !== "unmodified") modified++
    else if (f.index !== "unmodified") staged++
  }
  return { staged, modified, untracked, conflicts, total: files.length }
}
