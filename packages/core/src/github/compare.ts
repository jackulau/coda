import type { PrFile, PrView } from "./index"

export type CompareFileKind = "added-in-a" | "added-in-b" | "modified-in-both" | "same"

export interface CompareFileEntry {
  path: string
  kind: CompareFileKind
  additionsA: number
  deletionsA: number
  additionsB: number
  deletionsB: number
}

export interface CompareResult {
  files: CompareFileEntry[]
  totals: { added: number; modified: number; sharedPaths: number }
}

export function comparePrs(a: PrView, b: PrView): CompareResult {
  const byPathA = new Map(a.files.map((f) => [f.path, f]))
  const byPathB = new Map(b.files.map((f) => [f.path, f]))
  const paths = new Set<string>([...byPathA.keys(), ...byPathB.keys()])
  const files: CompareFileEntry[] = []
  for (const p of paths) {
    const fa = byPathA.get(p)
    const fb = byPathB.get(p)
    files.push({
      path: p,
      kind: classify(fa, fb),
      additionsA: fa?.additions ?? 0,
      deletionsA: fa?.deletions ?? 0,
      additionsB: fb?.additions ?? 0,
      deletionsB: fb?.deletions ?? 0,
    })
  }
  files.sort((x, y) => x.path.localeCompare(y.path))
  let added = 0
  let modified = 0
  let shared = 0
  for (const f of files) {
    if (f.kind === "added-in-a" || f.kind === "added-in-b") added++
    else if (f.kind === "modified-in-both") modified++
    if (f.kind !== "added-in-a" && f.kind !== "added-in-b") shared++
  }
  return { files, totals: { added, modified, sharedPaths: shared } }
}

function classify(a: PrFile | undefined, b: PrFile | undefined): CompareFileKind {
  if (a && !b) return "added-in-a"
  if (b && !a) return "added-in-b"
  if (!a || !b) return "same"
  if (a.additions === b.additions && a.deletions === b.deletions && a.patch === b.patch) {
    return "same"
  }
  return "modified-in-both"
}
