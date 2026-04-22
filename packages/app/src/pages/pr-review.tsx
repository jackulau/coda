import type { PrFile, PrView } from "@coda/core/github"
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileDiff,
  FilePlus,
  FileX,
  GitPullRequestArrow,
  Loader,
  MessageSquare,
  User,
  XCircle,
} from "lucide-solid"
import { type Component, For, Show, createSignal, onMount } from "solid-js"
import { DiffView } from "../components/diff-view"

interface Props {
  cwd?: string
  pr?: PrView | null
  onApprove?: () => void
  onComment?: (body: string) => void
}

const STATE_COLORS: Record<string, string> = {
  open: "var(--diff-add)",
  closed: "var(--diff-remove)",
  merged: "var(--accent-500)",
}

export const PrReviewPanel: Component<Props> = (props) => {
  const [expandedFile, setExpandedFile] = createSignal<string | null>(null)
  const [comment, setComment] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [pr, setPr] = createSignal<PrView | null>(props.pr ?? null)
  const [error, setError] = createSignal<string | null>(null)

  onMount(async () => {
    if (props.pr !== undefined) {
      setPr(props.pr ?? null)
      return
    }
    if (!props.cwd) return
    setLoading(true)
    try {
      const { PrClient } = await import("@coda/core/github/pr")
      const token =
        typeof globalThis.process !== "undefined"
          ? (globalThis.process as { env?: Record<string, string> }).env?.GITHUB_TOKEN
          : undefined
      if (!token) {
        setError("Set GITHUB_TOKEN to enable PR review")
        return
      }
      const client = new PrClient({ fetch: globalThis.fetch, token })
      const remote = await getRemoteInfo(props.cwd)
      if (!remote) {
        setError("No GitHub remote detected")
        return
      }
      const prs = await client.list({
        owner: remote.owner,
        repo: remote.repo,
        state: "open",
        limit: 10,
      })
      const branch = await getCurrentBranch(props.cwd)
      const match = prs.find((p) => p.headSha && branch && p.title.length > 0)
      if (match) {
        const full = await client.get({
          owner: remote.owner,
          repo: remote.repo,
          number: match.number,
        })
        setPr(full)
      } else {
        setError("No open PR for this branch")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  })

  const toggleFile = (path: string) => {
    setExpandedFile((prev) => (prev === path ? null : path))
  }

  const fileGlyph = (status: PrFile["status"]) => {
    if (status === "added") return FilePlus
    if (status === "removed") return FileX
    return FileDiff
  }

  const fileTone = (status: PrFile["status"]) => {
    if (status === "added") return "var(--diff-add)"
    if (status === "removed") return "var(--diff-remove)"
    return "var(--text-secondary)"
  }

  return (
    <div
      data-testid="pr-review-panel"
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
        <GitPullRequestArrow size={14} style={{ color: "var(--text-tertiary)" }} />
        <span style={{ "font-size": "13px", "font-weight": 500, color: "var(--text-primary)" }}>
          PR Review
        </span>
      </div>

      <div style={{ flex: "1 1 auto", overflow: "auto" }}>
        <Show when={loading()}>
          <div
            style={{
              padding: "48px 16px",
              "text-align": "center",
              color: "var(--text-tertiary)",
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              gap: "10px",
            }}
          >
            <Loader size={20} style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ "font-size": "12px" }}>Loading PR…</div>
          </div>
        </Show>

        <Show when={error() && !loading()}>
          <div
            data-testid="pr-review-empty"
            style={{
              padding: "48px 16px",
              "text-align": "center",
              color: "var(--text-tertiary)",
              "font-size": "12px",
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              gap: "10px",
            }}
          >
            <GitPullRequestArrow size={24} style={{ opacity: "0.4" }} />
            <div>{error()}</div>
          </div>
        </Show>

        <Show when={pr()}>
          {(prData) => {
            const p = (): PrView => prData() as unknown as PrView
            return (
              <>
                {/* PR info */}
                <div style={{ padding: "16px", "border-bottom": "1px solid var(--border-subtle)" }}>
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "8px",
                      "margin-bottom": "8px",
                    }}
                  >
                    <span
                      data-testid="pr-review-state"
                      style={{
                        "font-size": "11px",
                        "font-weight": 500,
                        color: STATE_COLORS[p().state] ?? "var(--text-secondary)",
                        background: "var(--bg-3)",
                        padding: "2px 8px",
                        "border-radius": "10px",
                        "text-transform": "capitalize",
                      }}
                    >
                      {p().state}
                    </span>
                    <span
                      style={{
                        "font-family": "var(--font-mono)",
                        "font-size": "11px",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      #{p().number}
                    </span>
                  </div>
                  <h2
                    data-testid="pr-review-title"
                    style={{
                      margin: "0 0 8px",
                      "font-size": "15px",
                      "font-weight": 600,
                      color: "var(--text-primary)",
                      "line-height": 1.4,
                    }}
                  >
                    {p().title}
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "12px",
                      "font-size": "11px",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <span
                      data-testid="pr-review-author"
                      style={{ display: "inline-flex", "align-items": "center", gap: "4px" }}
                    >
                      <User size={11} /> {p().author}
                    </span>
                    <span data-testid="pr-review-file-count">{p().files.length} files</span>
                    <span style={{ "font-family": "var(--font-mono)" }}>
                      <span style={{ color: "var(--diff-add)" }}>
                        +{p().files.reduce((s: number, f: PrFile) => s + f.additions, 0)}
                      </span>
                      <span style={{ color: "var(--diff-remove)", "margin-left": "4px" }}>
                        −{p().files.reduce((s: number, f: PrFile) => s + f.deletions, 0)}
                      </span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px", "margin-top": "12px" }}>
                    <Show when={props.onApprove}>
                      <button
                        type="button"
                        data-testid="pr-review-approve"
                        onClick={() => props.onApprove?.()}
                        style={{
                          padding: "6px 12px",
                          "font-size": "12px",
                          "border-radius": "4px",
                          border: "1px solid var(--diff-add)",
                          background: "transparent",
                          color: "var(--diff-add)",
                          cursor: "pointer",
                          display: "inline-flex",
                          "align-items": "center",
                          gap: "4px",
                        }}
                      >
                        <Check size={12} /> Approve
                      </button>
                    </Show>
                    <Show when={props.onComment}>
                      <div style={{ display: "flex", gap: "4px", flex: "1 1 auto" }}>
                        <input
                          type="text"
                          placeholder="Leave a comment…"
                          value={comment()}
                          onInput={(e) => setComment(e.currentTarget.value)}
                          style={{
                            flex: "1 1 auto",
                            padding: "6px 10px",
                            "font-size": "12px",
                            background: "var(--bg-input)",
                            border: "1px solid var(--border-subtle)",
                            "border-radius": "4px",
                            color: "var(--text-primary)",
                            outline: "none",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (comment().trim()) {
                              props.onComment?.(comment())
                              setComment("")
                            }
                          }}
                          style={{
                            padding: "6px 10px",
                            "font-size": "12px",
                            "border-radius": "4px",
                            border: "1px solid var(--border-subtle)",
                            background: "var(--bg-2)",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            display: "inline-flex",
                            "align-items": "center",
                            gap: "4px",
                          }}
                        >
                          <MessageSquare size={12} /> Comment
                        </button>
                      </div>
                    </Show>
                  </div>
                </div>

                {/* Files */}
                <div
                  style={{
                    padding: "8px 16px 4px",
                    "font-size": "11px",
                    "font-weight": 600,
                    color: "var(--text-secondary)",
                    "text-transform": "uppercase",
                    "letter-spacing": "0.5px",
                  }}
                >
                  Changed Files
                </div>
                <div style={{ padding: "0 8px 12px" }}>
                  <For each={p().files}>
                    {(f) => {
                      const Glyph = fileGlyph(f.status)
                      const tone = fileTone(f.status)
                      return (
                        <>
                          <button
                            type="button"
                            class="coda-row-hover"
                            onClick={() => toggleFile(f.path)}
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
                            <Show when={f.blobUrl}>
                              <a
                                href={f.blobUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ color: "var(--text-tertiary)", "flex-shrink": "0" }}
                              >
                                <ExternalLink size={11} />
                              </a>
                            </Show>
                          </button>
                          <Show when={expandedFile() === f.path && f.patch}>
                            <div
                              style={{
                                margin: "4px 0 8px 20px",
                                "border-radius": "4px",
                                overflow: "hidden",
                                border: "1px solid var(--border-subtle)",
                              }}
                            >
                              <DiffView patch={f.patch ?? ""} newPath={f.path} />
                            </div>
                          </Show>
                        </>
                      )
                    }}
                  </For>
                </div>
              </>
            )
          }}
        </Show>
      </div>
    </div>
  )
}

async function getRemoteInfo(cwd: string): Promise<{ owner: string; repo: string } | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core")
    const result = await invoke<string>("pty_write", {}) // Won't actually work, placeholder
    void result
  } catch {
    // Fall through
  }
  return null
}

async function getCurrentBranch(_cwd: string): Promise<string | null> {
  return null
}
