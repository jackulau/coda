export interface AriaNode {
  tag: string
  role?: string
  name?: string
  level?: number
  checked?: boolean
  ariaHidden?: boolean
  ariaLevel?: number
  children: AriaNode[]
}

export interface AriaRef {
  ref: string
  node: AriaNode
}

export interface SnapshotOptions {
  maxDepth?: number
}

const INTERACTIVE_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "switch",
  "combobox",
  "menuitem",
  "tab",
])

export function roleOf(node: AriaNode): string | undefined {
  if (node.role) return node.role
  const tag = node.tag.toLowerCase()
  switch (tag) {
    case "button":
      return "button"
    case "a":
      return "link"
    case "input":
      return "textbox"
    case "nav":
      return "navigation"
    case "header":
      return "banner"
    case "main":
      return "main"
    case "footer":
      return "contentinfo"
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "heading"
    default:
      return undefined
  }
}

export function levelOf(node: AriaNode): number | undefined {
  if (node.ariaLevel) return node.ariaLevel
  const m = node.tag.match(/^h([1-6])$/i)
  if (m?.[1]) return Number.parseInt(m[1], 10)
  return node.level
}

export function serializeSnapshot(
  root: AriaNode,
  opts: SnapshotOptions = {},
): { text: string; refs: AriaRef[] } {
  const refs: AriaRef[] = []
  const maxDepth = opts.maxDepth ?? 20
  const lines: string[] = []
  let refCounter = 0

  function walk(node: AriaNode, depth: number) {
    if (depth > maxDepth) return
    if (node.ariaHidden) return
    const role = roleOf(node)
    if (role === "presentation") return
    const indent = "  ".repeat(depth)
    const level = levelOf(node)
    const parts: string[] = []
    if (role) parts.push(role)
    else parts.push(node.tag.toLowerCase())
    if (node.name) parts.push(`"${node.name}"`)
    if (level !== undefined && role === "heading") parts.push(`[level=${level}]`)
    if (role === "checkbox" || role === "switch") {
      parts.push(node.checked ? "[checked]" : "[unchecked]")
    }
    const isInteractive = role !== undefined && INTERACTIVE_ROLES.has(role)
    if (isInteractive) {
      refCounter += 1
      const ref = `e${refCounter}`
      parts.push(`[ref=${ref}]`)
      refs.push({ ref, node })
    }
    const descriptor = parts.join(" ")
    lines.push(`${indent}- ${descriptor}`)
    for (const c of node.children) walk(c, depth + 1)
  }

  walk(root, 0)
  return { text: lines.join("\n"), refs }
}
