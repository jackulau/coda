import { type Component, For, type JSX, Show, createMemo, createSignal } from "solid-js"
import { type DirEntry, listDirectory as ipcListDirectory } from "../../lib/ipc"

// Keep the legacy shape so existing callers (file-tree.vitest.tsx) still
// work for the controlled/rows mode.
export interface FileTreeRow {
  path: string
  name: string
  kind: "file" | "directory"
  depth: number
}

/* -------------------------------------------------------------------------
 * Controlled mode: original usage. Caller passes a flat rows array and an
 * onOpen callback. Retained so unit tests covering visual/keyboard behavior
 * keep working.
 * -----------------------------------------------------------------------*/
interface ControlledProps {
  rows: FileTreeRow[]
  onOpen?: (path: string) => void
}

export const FileTreePanel: Component<ControlledProps> = (props) => {
  return (
    <div data-testid="file-tree-panel">
      <Show when={props.rows.length === 0}>
        <div data-testid="file-tree-empty">No files</div>
      </Show>
      <For each={props.rows}>
        {(row) => (
          <button
            type="button"
            data-testid={`file-tree-row-${row.path}`}
            data-kind={row.kind}
            onClick={() => props.onOpen?.(row.path)}
            style={{ "padding-left": `${row.depth * 12}px` }}
          >
            {row.name}
          </button>
        )}
      </For>
    </div>
  )
}

/* -------------------------------------------------------------------------
 * Live mode: reads the real filesystem over IPC with lazy expand.
 *
 *   <FileTreeLive rootPath="/a/b" onOpenFile={onOpen} />
 *
 * Children of each directory are loaded on first expand and cached until
 * the user clicks "Refresh" (which clears the cache and re-reads the root).
 * We never recurse automatically — node_modules stays collapsed unless the
 * user explicitly opens it.
 * -----------------------------------------------------------------------*/

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "loaded"; entries: DirEntry[] }
  | { kind: "error"; message: string }

interface LiveProps {
  rootPath: string
  onOpenFile?: (path: string) => void
  /** @internal test hook */
  listDirectory?: typeof ipcListDirectory
}

type FlatRow = {
  key: string
  path: string
  name: string
  kind: "file" | "directory"
  depth: number
  expanded: boolean
  state?: LoadState
  errorMessage?: string
}

export const FileTreeLive: Component<LiveProps> = (props) => {
  const list = props.listDirectory ?? ipcListDirectory

  // cache of directory reads, keyed by absolute path
  const [cache, setCache] = createSignal<Map<string, LoadState>>(new Map())
  // which directories are expanded (including root)
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set([props.rootPath]))
  const [focusedKey, setFocusedKey] = createSignal<string | null>(null)

  async function loadDir(p: string): Promise<void> {
    setCache((m) => {
      const next = new Map(m)
      next.set(p, { kind: "loading" })
      return next
    })
    try {
      const entries = await list(p)
      setCache((m) => {
        const next = new Map(m)
        next.set(p, { kind: "loaded", entries })
        return next
      })
    } catch (err) {
      setCache((m) => {
        const next = new Map(m)
        next.set(p, {
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        })
        return next
      })
    }
  }

  // Kick off the root load + any directory that becomes expanded without a
  // cache entry.
  const ensureLoaded = (p: string) => {
    const state = cache().get(p)
    if (!state || state.kind === "idle") {
      void loadDir(p)
    }
  }

  // On first render, load the root.
  ensureLoaded(props.rootPath)

  function toggle(path: string): void {
    const cur = expanded()
    const next = new Set(cur)
    if (next.has(path)) {
      next.delete(path)
    } else {
      next.add(path)
      ensureLoaded(path)
    }
    setExpanded(next)
  }

  function refresh(): void {
    setCache(new Map())
    setExpanded(new Set([props.rootPath]))
    ensureLoaded(props.rootPath)
  }

  const rows = createMemo<FlatRow[]>(() => {
    const out: FlatRow[] = []
    const visit = (path: string, depth: number) => {
      const state = cache().get(path)
      if (!state) return
      if (state.kind === "loading") {
        out.push({
          key: `${path}::loading`,
          path,
          name: "Loading…",
          kind: "directory",
          depth,
          expanded: true,
          state,
        })
        return
      }
      if (state.kind === "error") {
        out.push({
          key: `${path}::error`,
          path,
          name: `Couldn't load (${state.message})`,
          kind: "directory",
          depth,
          expanded: true,
          state,
          errorMessage: state.message,
        })
        return
      }
      if (state.kind === "loaded") {
        if (state.entries.length === 0) {
          out.push({
            key: `${path}::empty`,
            path,
            name: "Empty directory",
            kind: "directory",
            depth,
            expanded: true,
            state,
          })
          return
        }
        for (const e of state.entries) {
          const isExpanded = expanded().has(e.path)
          out.push({
            key: e.path,
            path: e.path,
            name: e.name,
            kind: e.kind,
            depth,
            expanded: isExpanded,
          })
          if (e.kind === "directory" && isExpanded) {
            visit(e.path, depth + 1)
          }
        }
      }
    }
    visit(props.rootPath, 0)
    return out
  })

  function onRowKeyDown(e: KeyboardEvent, row: FlatRow, idx: number): void {
    const all = rows()
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault()
        const nxt = all[idx + 1]
        if (nxt) setFocusedKey(nxt.key)
        break
      }
      case "ArrowUp": {
        e.preventDefault()
        const prv = all[idx - 1]
        if (prv) setFocusedKey(prv.key)
        break
      }
      case "ArrowRight": {
        e.preventDefault()
        if (row.kind === "directory" && !row.expanded) toggle(row.path)
        break
      }
      case "ArrowLeft": {
        e.preventDefault()
        if (row.kind === "directory" && row.expanded) toggle(row.path)
        break
      }
      case "Enter":
      case " ": {
        e.preventDefault()
        if (row.kind === "directory") toggle(row.path)
        else props.onOpenFile?.(row.path)
        break
      }
    }
  }

  function renderRow(row: FlatRow, idx: number): JSX.Element {
    const isErr = row.state?.kind === "error"
    const isLoad = row.state?.kind === "loading"
    const chevron = row.kind === "directory" && !row.state ? (row.expanded ? "▾" : "▸") : ""
    return (
      <button
        type="button"
        data-testid={`file-tree-row-${row.path}`}
        data-kind={row.kind}
        data-depth={row.depth}
        data-expanded={row.expanded ? "true" : "false"}
        data-focused={focusedKey() === row.key ? "true" : "false"}
        data-loading={isLoad ? "true" : undefined}
        data-error={isErr ? "true" : undefined}
        tabIndex={focusedKey() === row.key ? 0 : -1}
        onFocus={() => setFocusedKey(row.key)}
        onClick={() => {
          if (row.state) return
          if (row.kind === "directory") toggle(row.path)
          else props.onOpenFile?.(row.path)
        }}
        onKeyDown={(e) => onRowKeyDown(e, row, idx)}
        style={{
          display: "flex",
          "align-items": "center",
          width: "100%",
          "padding-left": `${row.depth * 12 + 8}px`,
          padding: "2px 8px",
          "padding-block": "2px",
          "background-color": focusedKey() === row.key ? "var(--bg-2)" : "transparent",
          color: isErr ? "var(--diff-remove)" : "var(--text-primary)",
          "font-size": "12px",
          border: "none",
          "text-align": "left",
          cursor: row.state ? "default" : "pointer",
        }}
      >
        <span style={{ width: "12px", "flex-shrink": 0 }}>{chevron}</span>
        <span style={{ opacity: isLoad ? 0.6 : 1 }}>{row.name}</span>
      </button>
    )
  }

  return (
    <div
      data-testid="file-tree-live"
      style={{
        display: "flex",
        "flex-direction": "column",
        "min-height": 0,
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "4px 8px",
          "border-bottom": "1px solid var(--border-subtle)",
          "font-size": "11px",
          color: "var(--text-tertiary)",
        }}
      >
        <span>FILES</span>
        <button
          type="button"
          data-testid="file-tree-refresh"
          onClick={refresh}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            "font-size": "11px",
          }}
        >
          ↻
        </button>
      </div>
      <div style={{ flex: "1 1 auto", "overflow-y": "auto" }}>
        <For each={rows()}>{(row, idx) => renderRow(row, idx())}</For>
        <Show when={rows().length === 0}>
          <div data-testid="file-tree-empty" style={{ padding: "8px" }}>
            No files
          </div>
        </Show>
      </div>
    </div>
  )
}
