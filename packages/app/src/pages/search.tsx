import { CaseSensitive, FileCode, Regex, Search } from "lucide-solid"
import { type Component, For, Show, createMemo, createSignal, onCleanup } from "solid-js"
import type { SearchHit } from "../lib/ipc"
import { searchFiles } from "../lib/ipc"

interface Props {
  cwd?: string
  onOpenFile?: (path: string, line: number) => void
}

interface FileGroup {
  path: string
  hits: SearchHit[]
}

export const SearchPage: Component<Props> = (props) => {
  const [query, setQuery] = createSignal("")
  const [hits, setHits] = createSignal<SearchHit[]>([])
  const [loading, setLoading] = createSignal(false)
  const [caseSensitive, setCaseSensitive] = createSignal(false)
  const [useRegex, setUseRegex] = createSignal(false)
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let inputRef: HTMLInputElement | undefined

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  const doSearch = async (q: string) => {
    if (!q.trim() || !props.cwd) {
      setHits([])
      return
    }
    setLoading(true)
    try {
      const results = await searchFiles(props.cwd, q, caseSensitive(), useRegex())
      setHits(results)
    } catch {
      setHits([])
    } finally {
      setLoading(false)
    }
  }

  const onInput = (value: string) => {
    setQuery(value)
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => doSearch(value), 300)
  }

  const grouped = createMemo((): FileGroup[] => {
    const map = new Map<string, SearchHit[]>()
    for (const h of hits()) {
      const arr = map.get(h.path)
      if (arr) arr.push(h)
      else map.set(h.path, [h])
    }
    return Array.from(map.entries()).map(([path, hits]) => ({ path, hits }))
  })

  const fileCount = () => grouped().length
  const hitCount = () => hits().length

  const summary = () => {
    const h = hitCount()
    const f = fileCount()
    if (h === 0) return ""
    return `${h} result${h !== 1 ? "s" : ""} in ${f} file${f !== 1 ? "s" : ""}`
  }

  requestAnimationFrame(() => inputRef?.focus())

  return (
    <div
      data-testid="search-page"
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        "min-height": 0,
      }}
    >
      {/* Search bar */}
      <div
        style={{
          padding: "12px 16px",
          "border-bottom": "1px solid var(--border-subtle)",
          display: "flex",
          "align-items": "center",
          gap: "8px",
        }}
      >
        <Search size={14} style={{ color: "var(--text-tertiary)", "flex-shrink": "0" }} />
        <input
          ref={inputRef}
          data-testid="search-input"
          type="text"
          placeholder="Search across files…"
          value={query()}
          onInput={(e) => onInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              doSearch(query())
            }
          }}
          style={{
            flex: "1 1 auto",
            background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
            "border-radius": "4px",
            padding: "7px 10px",
            color: "var(--text-primary)",
            "font-size": "13px",
            outline: "none",
          }}
        />
        <button
          type="button"
          title="Case sensitive"
          onClick={() => {
            setCaseSensitive((v) => !v)
            doSearch(query())
          }}
          style={{
            background: caseSensitive() ? "var(--bg-3)" : "transparent",
            border: caseSensitive() ? "1px solid var(--border-emphasis)" : "1px solid transparent",
            "border-radius": "4px",
            padding: "4px",
            color: caseSensitive() ? "var(--text-primary)" : "var(--text-tertiary)",
            cursor: "pointer",
            display: "inline-flex",
          }}
        >
          <CaseSensitive size={16} />
        </button>
        <button
          type="button"
          title="Use regex"
          onClick={() => {
            setUseRegex((v) => !v)
            doSearch(query())
          }}
          style={{
            background: useRegex() ? "var(--bg-3)" : "transparent",
            border: useRegex() ? "1px solid var(--border-emphasis)" : "1px solid transparent",
            "border-radius": "4px",
            padding: "4px",
            color: useRegex() ? "var(--text-primary)" : "var(--text-tertiary)",
            cursor: "pointer",
            display: "inline-flex",
          }}
        >
          <Regex size={16} />
        </button>
      </div>

      {/* Summary */}
      <Show when={summary()}>
        <div
          style={{
            padding: "6px 16px",
            "font-size": "11px",
            color: "var(--text-tertiary)",
            "border-bottom": "1px solid var(--border-subtle)",
          }}
        >
          {summary()}
        </div>
      </Show>

      {/* Results */}
      <div style={{ flex: "1 1 auto", overflow: "auto", padding: "0 0 12px" }}>
        <Show when={loading()}>
          <div
            style={{
              padding: "24px 16px",
              color: "var(--text-tertiary)",
              "text-align": "center",
              "font-size": "12px",
            }}
          >
            Searching…
          </div>
        </Show>

        <Show when={!loading() && query().trim() && hits().length === 0}>
          <div
            data-testid="search-empty"
            style={{
              padding: "24px 16px",
              color: "var(--text-tertiary)",
              "text-align": "center",
              "font-size": "12px",
            }}
          >
            No matches found
          </div>
        </Show>

        <Show when={!loading() && !query().trim()}>
          <div
            style={{
              padding: "48px 16px",
              color: "var(--text-tertiary)",
              "text-align": "center",
              "font-size": "12px",
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              gap: "10px",
            }}
          >
            <Search size={24} style={{ opacity: "0.4" }} />
            <div>Type to search across your workspace</div>
            <div style={{ "font-size": "11px" }}>
              Use{" "}
              <kbd
                style={{ background: "var(--bg-3)", padding: "1px 4px", "border-radius": "2px" }}
              >
                ⌘⇧F
              </kbd>{" "}
              to jump here
            </div>
          </div>
        </Show>

        <For each={grouped()}>
          {(group) => (
            <div data-testid={`search-group-${group.path}`}>
              <div
                style={{
                  padding: "8px 16px 4px",
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                }}
              >
                <FileCode size={12} style={{ color: "var(--text-tertiary)", "flex-shrink": "0" }} />
                <span
                  style={{
                    "font-size": "12px",
                    color: "var(--text-secondary)",
                    "font-family": "var(--font-mono)",
                    "white-space": "nowrap",
                    overflow: "hidden",
                    "text-overflow": "ellipsis",
                  }}
                >
                  {group.path}
                </span>
                <span style={{ "font-size": "10px", color: "var(--text-tertiary)" }}>
                  ({group.hits.length})
                </span>
              </div>
              <For each={group.hits}>
                {(hit) => (
                  <button
                    type="button"
                    class="coda-row-hover"
                    data-testid={`search-hit-${hit.path}-${hit.line}`}
                    onClick={() => {
                      const fullPath = props.cwd ? `${props.cwd}/${hit.path}` : hit.path
                      props.onOpenFile?.(fullPath, hit.line)
                    }}
                    style={{
                      width: "100%",
                      padding: "3px 16px 3px 34px",
                      "text-align": "left",
                      background: "transparent",
                      border: "none",
                      color: "var(--text-primary)",
                      "font-size": "12px",
                      "font-family": "var(--font-mono)",
                      cursor: "pointer",
                      display: "flex",
                      "align-items": "baseline",
                      gap: "10px",
                      "border-radius": "3px",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-tertiary)",
                        "font-size": "10px",
                        "flex-shrink": "0",
                        "min-width": "28px",
                        "text-align": "right",
                      }}
                    >
                      {hit.line}
                    </span>
                    <span
                      style={{
                        "white-space": "pre",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                      }}
                    >
                      {hit.preview}
                    </span>
                  </button>
                )}
              </For>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
