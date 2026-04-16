export interface SemanticToken {
  line: number
  char: number
  length: number
  type: string
  modifiers: string[]
}

export interface EncodedTokens {
  data: number[]
  types: string[]
  modifiers: string[]
}

export function decodeSemanticTokens(encoded: EncodedTokens): SemanticToken[] {
  const { data, types, modifiers } = encoded
  const out: SemanticToken[] = []
  let line = 0
  let char = 0
  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i] ?? 0
    const deltaChar = data[i + 1] ?? 0
    const length = data[i + 2] ?? 0
    const tokenType = data[i + 3] ?? 0
    const modBitset = data[i + 4] ?? 0
    if (deltaLine > 0) {
      line += deltaLine
      char = deltaChar
    } else {
      char += deltaChar
    }
    const mods: string[] = []
    for (let b = 0; b < modifiers.length; b++) {
      if (modBitset & (1 << b)) {
        const name = modifiers[b]
        if (name !== undefined) mods.push(name)
      }
    }
    out.push({
      line,
      char,
      length,
      type: types[tokenType] ?? "unknown",
      modifiers: mods,
    })
  }
  return out
}

export interface RenameEdit {
  file: string
  range: { startLine: number; startChar: number; endLine: number; endChar: number }
  newText: string
}

export interface WorkspaceEdit {
  edits: RenameEdit[]
}

export function summarizeRename(edit: WorkspaceEdit): {
  filesTouched: number
  totalEdits: number
  byFile: Record<string, number>
} {
  const byFile: Record<string, number> = {}
  for (const e of edit.edits) byFile[e.file] = (byFile[e.file] ?? 0) + 1
  return {
    filesTouched: Object.keys(byFile).length,
    totalEdits: edit.edits.length,
    byFile,
  }
}

export interface DocumentSymbol {
  name: string
  kind: "function" | "class" | "variable" | "method" | "property" | "module"
  line: number
  children: DocumentSymbol[]
}

export function flattenSymbols(syms: DocumentSymbol[]): DocumentSymbol[] {
  const out: DocumentSymbol[] = []
  function walk(s: DocumentSymbol) {
    out.push(s)
    for (const c of s.children) walk(c)
  }
  for (const s of syms) walk(s)
  return out
}

export interface LspRequest {
  id: number
  method: string
  sentAt: number
}

export class LspPendingQueue {
  private pending = new Map<number, LspRequest>()

  constructor(
    private readonly cap = 50,
    private readonly timeoutMs = 15_000,
  ) {}

  add(req: LspRequest): LspRequest | null {
    let evicted: LspRequest | null = null
    if (this.pending.size >= this.cap) {
      const oldest = [...this.pending.values()].sort((a, b) => a.sentAt - b.sentAt)[0]
      if (oldest) {
        evicted = oldest
        this.pending.delete(oldest.id)
      }
    }
    this.pending.set(req.id, req)
    return evicted
  }

  complete(id: number): LspRequest | null {
    const r = this.pending.get(id) ?? null
    this.pending.delete(id)
    return r
  }

  timedOut(now: number): LspRequest[] {
    const stale: LspRequest[] = []
    for (const r of this.pending.values()) {
      if (now - r.sentAt >= this.timeoutMs) stale.push(r)
    }
    for (const r of stale) this.pending.delete(r.id)
    return stale
  }

  size(): number {
    return this.pending.size
  }
}
