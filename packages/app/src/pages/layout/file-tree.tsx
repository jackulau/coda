import { ChevronDown, ChevronRight, File as FileIcon, Folder, RefreshCw } from "lucide-solid"
import {
  type Component,
  For,
  type JSX,
  Show,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js"
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

  // Reload whenever the root path changes — e.g. the user switches workspace.
  // Without this effect, the tree clung to the first workspace's cache and
  // showed "No files" for every workspace opened after that.
  createEffect(() => {
    const root = props.rootPath
    setCache(new Map())
    setExpanded(new Set([root]))
    void loadDir(root)
  })

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

  function focusRowByKey(key: string): void {
    setFocusedKey(key)
    // Imperatively move DOM focus in the next microtask so the newly
    // tab-reachable row also receives the visible focus ring; without
    // this the data-focused attribute updates but focus stays on the
    // previous row, so screen readers and the focus outline disagree.
    queueMicrotask(() => {
      const sel = `[data-testid="file-tree-row-${CSS.escape(key)}"]`
      const el = document.querySelector(sel) as HTMLElement | null
      el?.focus()
    })
  }

  function onRowKeyDown(e: KeyboardEvent, row: FlatRow, idx: number): void {
    const all = rows()
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault()
        const nxt = all[idx + 1]
        if (nxt) focusRowByKey(nxt.key)
        break
      }
      case "ArrowUp": {
        e.preventDefault()
        const prv = all[idx - 1]
        if (prv) focusRowByKey(prv.key)
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
    const showChevron = row.kind === "directory" && !row.state
    return (
      <button
        type="button"
        class="coda-row-hover"
        data-testid={`file-tree-row-${row.path}`}
        data-kind={row.kind}
        data-depth={row.depth}
        data-expanded={row.expanded ? "true" : "false"}
        data-focused={focusedKey() === row.key ? "true" : "false"}
        data-loading={isLoad ? "true" : undefined}
        data-error={isErr ? "true" : undefined}
        tabIndex={focusedKey() === row.key || (focusedKey() === null && idx === 0) ? 0 : -1}
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
          gap: "4px",
          width: "100%",
          height: "22px",
          padding: `0 8px 0 ${row.depth * 12 + 8}px`,
          "background-color": focusedKey() === row.key ? "var(--bg-2)" : "transparent",
          color: isErr ? "var(--diff-remove)" : "var(--text-primary)",
          "font-size": "12px",
          border: "none",
          "text-align": "left",
          cursor: row.state ? "default" : "pointer",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: "12px",
            "flex-shrink": 0,
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            color: "var(--text-tertiary)",
          }}
        >
          {showChevron && (row.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
        </span>
        <span
          aria-hidden="true"
          data-testid={`file-tree-glyph-${row.kind === "directory" ? "folder" : "file"}`}
          style={{
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            "flex-shrink": 0,
            color: row.kind === "directory" ? "var(--text-secondary)" : "var(--text-tertiary)",
          }}
        >
          {row.kind === "directory" ? <Folder size={13} /> : <FileIcon size={13} />}
        </span>
        {isLoad ? (
          <span
            class="coda-skeleton-row"
            style={{
              flex: "1 1 auto",
              height: "12px",
              margin: "0",
              "background-color": "var(--bg-2)",
              "border-radius": "3px",
            }}
          />
        ) : (
          <span
            style={{ "white-space": "nowrap", overflow: "hidden", "text-overflow": "ellipsis" }}
          >
            {row.name}
          </span>
        )}
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
        <span style={{ "letter-spacing": "0.05em", "text-transform": "uppercase" }}>Files</span>
        <button
          type="button"
          data-testid="file-tree-refresh"
          onClick={refresh}
          aria-label="Refresh file tree"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            display: "inline-flex",
            "align-items": "center",
            padding: "2px",
          }}
        >
          <RefreshCw size={11} />
        </button>
      </div>
      <div style={{ flex: "1 1 auto", "overflow-y": "auto" }}>
        <Show
          when={cache().get(props.rootPath)?.kind !== "loading"}
          fallback={
            <div data-testid="file-tree-skeleton">
              <div class="coda-skeleton-row" style={{ width: "70%" }} />
              <div class="coda-skeleton-row" style={{ width: "85%" }} />
              <div class="coda-skeleton-row" style={{ width: "60%" }} />
            </div>
          }
        >
          <For each={rows()}>{(row, idx) => renderRow(row, idx())}</For>
          <Show when={rows().length === 0}>
            <div data-testid="file-tree-empty" style={{ padding: "8px" }}>
              No files
            </div>
          </Show>
        </Show>
      </div>
    </div>
  )
}
