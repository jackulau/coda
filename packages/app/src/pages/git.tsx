import {
  ChevronDown,
  ChevronRight,
  Clock,
  FileDiff,
  FilePlus,
  FileX,
  GitBranch,
  History,
} from "lucide-solid"
import { type Component, For, Show, createSignal, onMount } from "solid-js"
import { DiffView } from "../components/diff-view"
import type { ChangedFile, GitCommit } from "../lib/ipc"
import { getFileDiff, gitCommitDiff, gitLog } from "../lib/ipc"

interface Props {
  cwd?: string
  files: ChangedFile[]
  branch?: string
  onOpenFile?: (path: string) => void
}

export const GitPanel: Component<Props> = (props) => {
  const [expandedFile, setExpandedFile] = createSignal<string | null>(null)
  const [fileDiffs, setFileDiffs] = createSignal<Record<string, string>>({})
  const [loadingDiff, setLoadingDiff] = createSignal<string | null>(null)
  const [commits, setCommits] = createSignal<GitCommit[]>([])
  const [historyOpen, setHistoryOpen] = createSignal(true)
  const [expandedCommit, setExpandedCommit] = createSignal<string | null>(null)
  const [commitDiffs, setCommitDiffs] = createSignal<Record<string, string>>({})
  const [loadingCommitDiff, setLoadingCommitDiff] = createSignal<string | null>(null)
  const [logLimit, setLogLimit] = createSignal(50)

  const loadHistory = () => {
    if (!props.cwd) return
    gitLog(props.cwd, logLimit())
      .then(setCommits)
      .catch(() => setCommits([]))
  }

  onMount(loadHistory)

  const toggleFileDiff = async (filePath: string) => {
    if (expandedFile() === filePath) {
      setExpandedFile(null)
      return
    }
    setExpandedFile(filePath)
    if (fileDiffs()[filePath]) return
    if (!props.cwd) return
    setLoadingDiff(filePath)
    try {
      const diff = await getFileDiff(props.cwd, filePath)
      setFileDiffs((prev) => ({ ...prev, [filePath]: diff }))
    } catch {
      setFileDiffs((prev) => ({ ...prev, [filePath]: "" }))
    } finally {
      setLoadingDiff(null)
    }
  }

  const toggleCommitDiff = async (hash: string) => {
    if (expandedCommit() === hash) {
      setExpandedCommit(null)
      return
    }
    setExpandedCommit(hash)
    if (commitDiffs()[hash]) return
    if (!props.cwd) return
    setLoadingCommitDiff(hash)
    try {
      const diff = await gitCommitDiff(props.cwd, hash)
      setCommitDiffs((prev) => ({ ...prev, [hash]: diff }))
    } catch {
      setCommitDiffs((prev) => ({ ...prev, [hash]: "" }))
    } finally {
      setLoadingCommitDiff(null)
    }
  }

  const loadMore = () => {
    setLogLimit((l) => l + 50)
    loadHistory()
  }

  const relativeDate = (iso: string): string => {
    const d = new Date(iso)
    const now = Date.now()
    const diff = now - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    return d.toLocaleDateString()
  }

  return (
    <div
      data-testid="git-panel"
      style={{
        display: "flex",
        "flex-direction": "column",
        height: "100%",
        "min-height": 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          "border-bottom": "1px solid var(--border-subtle)",
          display: "flex",
          "align-items": "center",
          gap: "8px",
        }}
      >
        <GitBranch size={14} style={{ color: "var(--text-tertiary)" }} />
        <span style={{ "font-size": "13px", "font-weight": 500, color: "var(--text-primary)" }}>
          Source Control
        </span>
        <Show when={props.branch}>
          <span
            data-testid="git-branch"
            style={{
              "font-size": "11px",
              color: "var(--text-tertiary)",
              "font-family": "var(--font-mono)",
              background: "var(--bg-3)",
              padding: "1px 6px",
              "border-radius": "3px",
            }}
          >
            {props.branch}
          </span>
        </Show>
      </div>

      <div style={{ flex: "1 1 auto", overflow: "auto" }}>
        {/* Changes section */}
        <div style={{ "border-bottom": "1px solid var(--border-subtle)" }}>
          <div
            style={{
              padding: "8px 16px",
              "font-size": "11px",
              "font-weight": 600,
              color: "var(--text-secondary)",
              "text-transform": "uppercase",
              "letter-spacing": "0.5px",
              display: "flex",
              "align-items": "center",
              gap: "6px",
            }}
          >
            Changes
            <Show when={props.files.length > 0}>
              <span
                style={{
                  "font-family": "var(--font-mono)",
                  "font-weight": 400,
                  color: "var(--text-tertiary)",
                }}
              >
                ({props.files.length})
              </span>
            </Show>
          </div>

          <Show
            when={props.files.length > 0}
            fallback={
              <div
                data-testid="git-clean"
                style={{
                  padding: "16px",
                  color: "var(--text-tertiary)",
                  "font-size": "12px",
                  "text-align": "center",
                }}
              >
                Clean working tree
              </div>
            }
          >
            <div style={{ padding: "0 8px 8px" }}>
              <For each={props.files}>
                {(f) => {
                  const Glyph = f.kind === "add" ? FilePlus : f.kind === "delete" ? FileX : FileDiff
                  const tone =
                    f.kind === "add"
                      ? "var(--diff-add)"
                      : f.kind === "delete"
                        ? "var(--diff-remove)"
                        : "var(--text-secondary)"
                  return (
                    <>
                      <button
                        type="button"
                        class="coda-row-hover"
                        data-testid={`git-file-${f.path}`}
                        onClick={() => toggleFileDiff(f.path)}
                        style={{
                          width: "100%",
                          display: "flex",
                          "align-items": "center",
                          gap: "6px",
                          padding: "4px 8px",
                          "font-size": "12px",
                          "border-radius": "3px",
                          background: expandedFile() === f.path ? "var(--bg-2)" : "transparent",
                          border: "none",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          "text-align": "left",
                        }}
                      >
                        <span style={{ color: "var(--text-tertiary)", "flex-shrink": "0" }}>
                          {expandedFile() === f.path ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronRight size={12} />
                          )}
                        </span>
                        <Glyph size={13} style={{ color: tone, "flex-shrink": "0" }} />
                        <span
                          style={{
                            flex: "1 1 auto",
                            "white-space": "nowrap",
                            overflow: "hidden",
                            "text-overflow": "ellipsis",
                          }}
                        >
                          {f.path}
                        </span>
                        <Show when={loadingDiff() === f.path}>
                          <span style={{ "font-size": "10px", color: "var(--text-tertiary)" }}>
                            …
                          </span>
                        </Show>
                        <span
                          style={{
                            "font-family": "var(--font-mono)",
                            "font-size": "10px",
                            "flex-shrink": "0",
                          }}
                        >
                          <Show when={f.additions > 0}>
                            <span style={{ color: "var(--diff-add)" }}>+{f.additions}</span>
                          </Show>
                          <Show when={f.deletions > 0}>
                            <span style={{ color: "var(--diff-remove)", "margin-left": "4px" }}>
                              −{f.deletions}
                            </span>
                          </Show>
                        </span>
                      </button>
                      <Show when={expandedFile() === f.path && fileDiffs()[f.path]}>
                        <div
                          style={{
                            margin: "4px 0 8px 20px",
                            "border-radius": "4px",
                            overflow: "hidden",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <DiffView patch={fileDiffs()[f.path] ?? ""} />
                        </div>
                      </Show>
                    </>
                  )
                }}
              </For>
            </div>
          </Show>
        </div>

        {/* History section */}
        <div>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            style={{
              width: "100%",
              padding: "8px 16px",
              "font-size": "11px",
              "font-weight": 600,
              color: "var(--text-secondary)",
              "text-transform": "uppercase",
              "letter-spacing": "0.5px",
              display: "flex",
              "align-items": "center",
              gap: "6px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              "text-align": "left",
            }}
          >
            <span style={{ color: "var(--text-tertiary)" }}>
              {historyOpen() ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
            <History size={12} />
            Commit History
          </button>

          <Show when={historyOpen()}>
            <Show
              when={commits().length > 0}
              fallback={
                <div
                  style={{
                    padding: "16px",
                    color: "var(--text-tertiary)",
                    "font-size": "12px",
                    "text-align": "center",
                  }}
                >
                  No commits yet
                </div>
              }
            >
              <div style={{ padding: "0 8px 8px" }}>
                <For each={commits()}>
                  {(c) => (
                    <>
                      <button
                        type="button"
                        class="coda-row-hover"
                        onClick={() => toggleCommitDiff(c.hash)}
                        style={{
                          width: "100%",
                          display: "flex",
                          "align-items": "flex-start",
                          gap: "8px",
                          padding: "6px 8px",
                          "font-size": "12px",
                          "border-radius": "3px",
                          background: expandedCommit() === c.hash ? "var(--bg-2)" : "transparent",
                          border: "none",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                          "text-align": "left",
                        }}
                      >
                        <span
                          style={{
                            color: "var(--text-tertiary)",
                            "flex-shrink": "0",
                            "padding-top": "1px",
                          }}
                        >
                          {expandedCommit() === c.hash ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronRight size={12} />
                          )}
                        </span>
                        <div style={{ flex: "1 1 auto", "min-width": 0 }}>
                          <div
                            style={{
                              "white-space": "nowrap",
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                            }}
                          >
                            {c.message}
                          </div>
                          <div
                            style={{
                              "font-size": "10px",
                              color: "var(--text-tertiary)",
                              display: "flex",
                              gap: "8px",
                              "margin-top": "2px",
                            }}
                          >
                            <span style={{ "font-family": "var(--font-mono)" }}>{c.shortHash}</span>
                            <span>{c.author}</span>
                            <span
                              style={{
                                display: "inline-flex",
                                "align-items": "center",
                                gap: "3px",
                              }}
                            >
                              <Clock size={9} />
                              {relativeDate(c.date)}
                            </span>
                            <Show when={c.additions > 0 || c.deletions > 0}>
                              <span style={{ "font-family": "var(--font-mono)" }}>
                                <Show when={c.additions > 0}>
                                  <span style={{ color: "var(--diff-add)" }}>+{c.additions}</span>
                                </Show>
                                <Show when={c.deletions > 0}>
                                  <span
                                    style={{ color: "var(--diff-remove)", "margin-left": "2px" }}
                                  >
                                    −{c.deletions}
                                  </span>
                                </Show>
                              </span>
                            </Show>
                          </div>
                        </div>
                        <Show when={loadingCommitDiff() === c.hash}>
                          <span style={{ "font-size": "10px", color: "var(--text-tertiary)" }}>
                            …
                          </span>
                        </Show>
                      </button>
                      <Show when={expandedCommit() === c.hash && commitDiffs()[c.hash]}>
                        <div
                          style={{
                            margin: "4px 0 8px 20px",
                            "border-radius": "4px",
                            overflow: "hidden",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <DiffView patch={commitDiffs()[c.hash] ?? ""} />
                        </div>
                      </Show>
                    </>
                  )}
                </For>
                <Show when={commits().length >= logLimit()}>
                  <button
                    type="button"
                    onClick={loadMore}
                    style={{
                      width: "100%",
                      padding: "8px",
                      "font-size": "11px",
                      color: "var(--text-tertiary)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      "text-align": "center",
                    }}
                  >
                    Load more…
                  </button>
                </Show>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  )
}
