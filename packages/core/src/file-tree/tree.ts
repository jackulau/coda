export type FileNodeKind = "file" | "directory"

export interface FileNode {
  path: string
  name: string
  kind: FileNodeKind
  size?: number
  childCount?: number
}

export interface TreeNode extends FileNode {
  depth: number
  expanded: boolean
  hasChildren: boolean
}

export interface FlattenOptions {
  expandedPaths: Set<string>
  rootPath: string
}

export function flattenTree(entries: FileNode[], opts: FlattenOptions): TreeNode[] {
  const byParent = new Map<string, FileNode[]>()
  for (const e of entries) {
    const parent = dirname(e.path)
    const list = byParent.get(parent) ?? []
    list.push(e)
    byParent.set(parent, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }

  const out: TreeNode[] = []
  const walk = (parent: string, depth: number) => {
    const children = byParent.get(parent) ?? []
    for (const child of children) {
      const expanded = opts.expandedPaths.has(child.path)
      const hasChildren = child.kind === "directory" && (byParent.get(child.path)?.length ?? 0) > 0
      out.push({
        ...child,
        depth,
        expanded,
        hasChildren,
      })
      if (expanded && hasChildren) walk(child.path, depth + 1)
    }
  }
  walk(opts.rootPath, 0)
  return out
}

function dirname(p: string): string {
  const idx = p.lastIndexOf("/")
  return idx === -1 ? "" : p.slice(0, idx)
}

export interface FilterOptions {
  query: string
  caseSensitive?: boolean
}

export function filterNodes(nodes: FileNode[], opts: FilterOptions): FileNode[] {
  if (!opts.query) return nodes
  const q = opts.caseSensitive ? opts.query : opts.query.toLowerCase()
  const matched = new Set<string>()

  for (const n of nodes) {
    const name = opts.caseSensitive ? n.name : n.name.toLowerCase()
    if (name.includes(q)) {
      matched.add(n.path)
      let parent = dirname(n.path)
      while (parent && parent !== opts.query) {
        matched.add(parent)
        const next = dirname(parent)
        if (next === parent) break
        parent = next
      }
    }
  }
  return nodes.filter((n) => matched.has(n.path))
}
