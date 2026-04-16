export interface FindOptions {
  caseSensitive?: boolean
  wholeWord?: boolean
  regex?: boolean
}

export interface FindMatch {
  line: number
  column: number
  length: number
  text: string
}

export function buildPattern(needle: string, opts: FindOptions): RegExp {
  let pattern = needle
  if (!opts.regex) pattern = escapeRegExp(pattern)
  if (opts.wholeWord) pattern = `\\b${pattern}\\b`
  const flags = opts.caseSensitive ? "g" : "gi"
  return new RegExp(pattern, flags)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function findInText(haystack: string, needle: string, opts: FindOptions = {}): FindMatch[] {
  if (!needle) return []
  const re = buildPattern(needle, opts)
  const lines = haystack.split("\n")
  const matches: FindMatch[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ""
    const lineRe = new RegExp(re.source, re.flags)
    let m: RegExpExecArray | null
    // biome-ignore lint/suspicious/noAssignInExpressions: stdlib regex pattern
    while ((m = lineRe.exec(line)) !== null) {
      if (m[0].length === 0) {
        lineRe.lastIndex++
        continue
      }
      matches.push({ line: i + 1, column: m.index + 1, length: m[0].length, text: m[0] })
    }
  }
  return matches
}

export interface ReplaceOptions extends FindOptions {
  replacement: string
}

export function replaceInText(haystack: string, needle: string, opts: ReplaceOptions): string {
  if (!needle) return haystack
  const re = buildPattern(needle, opts)
  return haystack.replace(re, opts.replacement)
}

export interface FileMatch {
  path: string
  matches: FindMatch[]
}

export function findAcrossFiles(
  files: Array<{ path: string; content: string }>,
  needle: string,
  opts: FindOptions = {},
): FileMatch[] {
  const out: FileMatch[] = []
  for (const f of files) {
    const matches = findInText(f.content, needle, opts)
    if (matches.length > 0) out.push({ path: f.path, matches })
  }
  return out
}
