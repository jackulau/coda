export interface SelectorNode {
  tag: string
  id?: string
  classes?: string[]
  attributes?: Record<string, string>
  parent?: SelectorNode
  siblingIndex?: number
  siblingCount?: number
}

export interface ScoreEntry {
  selector: string
  penalty: number
  kind: "id" | "class" | "attribute" | "tag" | "nth"
}

export const PENALTIES: Record<ScoreEntry["kind"], number> = {
  id: 0,
  class: 1,
  attribute: 2,
  tag: 5,
  nth: 10,
}

export function scoreCandidates(node: SelectorNode): ScoreEntry[] {
  const out: ScoreEntry[] = []
  if (node.id) out.push({ selector: `#${cssEscape(node.id)}`, penalty: PENALTIES.id, kind: "id" })
  for (const cls of node.classes ?? []) {
    out.push({ selector: `.${cssEscape(cls)}`, penalty: PENALTIES.class, kind: "class" })
  }
  for (const [k, v] of Object.entries(node.attributes ?? {})) {
    out.push({
      selector: `[${k}="${cssEscape(v)}"]`,
      penalty: PENALTIES.attribute,
      kind: "attribute",
    })
  }
  out.push({ selector: node.tag.toLowerCase(), penalty: PENALTIES.tag, kind: "tag" })
  if (node.siblingIndex !== undefined) {
    out.push({
      selector: `${node.tag.toLowerCase()}:nth-of-type(${node.siblingIndex + 1})`,
      penalty: PENALTIES.nth,
      kind: "nth",
    })
  }
  out.sort((a, b) => a.penalty - b.penalty)
  return out
}

export type MatchCounter = (selector: string) => number

export function generateSelector(
  node: SelectorNode,
  count: MatchCounter,
  deadlineBudget = 50,
): string {
  const candidates = scoreCandidates(node)
  let budget = deadlineBudget
  for (const c of candidates) {
    budget -= 1
    if (budget < 0) break
    if (count(c.selector) === 1) return c.selector
  }
  const parts: string[] = []
  let cur: SelectorNode | undefined = node
  while (cur) {
    parts.unshift(
      cur.siblingIndex !== undefined
        ? `${cur.tag.toLowerCase()}:nth-of-type(${cur.siblingIndex + 1})`
        : cur.tag.toLowerCase(),
    )
    cur = cur.parent
  }
  return parts.join(" > ")
}

function cssEscape(s: string): string {
  return s.replace(/["\\]/g, "\\$&")
}
