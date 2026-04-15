export interface ScoredItem<T> {
  item: T
  score: number
  matches: number[]
}

export interface ScoreOptions {
  caseSensitive?: boolean
}

const SCORE_NO_MATCH = -1
const BONUS_CONSECUTIVE = 12
const BONUS_WORD_START = 10
const BONUS_FIRST_CHAR = 8
const PENALTY_GAP = 1

export function fuzzyScore(haystack: string, needle: string, opts: ScoreOptions = {}): number {
  if (needle.length === 0) return 0
  if (haystack.length === 0) return SCORE_NO_MATCH

  const h = opts.caseSensitive ? haystack : haystack.toLowerCase()
  const n = opts.caseSensitive ? needle : needle.toLowerCase()

  let score = 0
  let hi = 0
  let ni = 0
  let lastMatchIdx = -2
  let prevWasBoundary = true

  while (ni < n.length && hi < h.length) {
    const target = n[ni]
    const cur = h[hi]
    if (cur === target) {
      const isBoundary = hi === 0 || /[\s_/.\-]/.test(h[hi - 1] ?? " ")
      if (hi === 0) score += BONUS_FIRST_CHAR
      if (isBoundary) score += BONUS_WORD_START
      if (hi === lastMatchIdx + 1) score += BONUS_CONSECUTIVE
      lastMatchIdx = hi
      prevWasBoundary = isBoundary
      ni++
    } else {
      if (!prevWasBoundary) score -= PENALTY_GAP
      prevWasBoundary = false
    }
    hi++
  }

  if (ni < n.length) return SCORE_NO_MATCH
  return score
}

export function rank<T>(
  items: T[],
  needle: string,
  getKey: (item: T) => string,
  opts: ScoreOptions = {},
): ScoredItem<T>[] {
  if (needle.length === 0) return items.map((item) => ({ item, score: 0, matches: [] }))
  const out: ScoredItem<T>[] = []
  for (const item of items) {
    const score = fuzzyScore(getKey(item), needle, opts)
    if (score > SCORE_NO_MATCH) {
      out.push({ item, score, matches: matchPositions(getKey(item), needle, opts) })
    }
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return getKey(a.item).localeCompare(getKey(b.item))
  })
  return out
}

function matchPositions(haystack: string, needle: string, opts: ScoreOptions): number[] {
  const h = opts.caseSensitive ? haystack : haystack.toLowerCase()
  const n = opts.caseSensitive ? needle : needle.toLowerCase()
  const positions: number[] = []
  let ni = 0
  for (let hi = 0; hi < h.length && ni < n.length; hi++) {
    if (h[hi] === n[ni]) {
      positions.push(hi)
      ni++
    }
  }
  return positions
}
