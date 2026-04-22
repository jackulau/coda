import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FileDiff,
  FilePlus,
  FileX,
  GitPullRequestArrow,
  X,
} from "lucide-solid"
import { type Component, For, Show, createMemo, createSignal } from "solid-js"
import { DiffView } from "../../components/diff-view"
import { getFileDiff } from "../../lib/ipc"

export type ChangeKind = "add" | "modify" | "delete"

export interface ChangedFile {
  path: string
  kind: ChangeKind
  additions: number
  deletions: number
}

export interface ReviewChangesProps {
  files: ChangedFile[]
  cwd?: string
  prNumber?: number
  onPush?: (commitMessage: string) => void
  onClose?: () => void
}

export const ReviewChangesPanel: Component<ReviewChangesProps> = (props) => {
  const [message, setMessage] = createSignal("")
  const [expandedFile, setExpandedFile] = createSignal<string | null>(null)
  const [diffCache, setDiffCache] = createSignal<Record<string, string>>({})
  const [loadingDiff, setLoadingDiff] = createSignal<string | null>(null)
  const grouped = createMemo(() => groupByDir(props.files))
  const canPush = () => props.files.length > 0

  const toggleDiff = async (filePath: string) => {
    if (expandedFile() === filePath) {
      setExpandedFile(null)
      return
    }
    setExpandedFile(filePath)
    if (diffCache()[filePath]) return
    if (!props.cwd) return
    setLoadingDiff(filePath)
    try {
      const diff = await getFileDiff(props.cwd, filePath)
      setDiffCache((prev) => ({ ...prev, [filePath]: diff }))
    } catch {
      setDiffCache((prev) => ({ ...prev, [filePath]: "" }))
    } finally {
      setLoadingDiff(null)
    }
  }

  return (
    <div
      data-testid="review-changes-panel"
      style={{
        display: "flex",
        "flex-direction": "column",
        "min-height": 0,
        height: "100%",
      }}
    >
      <header
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "12px 14px",
          "border-bottom": "1px solid var(--border-subtle)",
        }}
      >
        <span style={{ "font-size": "13px", color: "var(--text-primary)", "font-weight": 500 }}>
          Review Changes
        </span>
        <span style={{ display: "inline-flex", "align-items": "center", gap: "10px" }}>
          <Show when={props.prNumber}>
            {(n) => (
              <span
                data-testid="review-pr-number"
                style={{
                  display: "inline-flex",
                  "align-items": "center",
                  gap: "4px",
                  color: "var(--text-tertiary)",
                  "font-family": "var(--font-mono)",
                  "font-size": "11px",
                }}
              >
                <GitPullRequestArrow size={12} aria-hidden="true" />#{n()}
              </span>
            )}
          </Show>
          <Show when={props.onClose}>
            <button
              type="button"
              data-testid="review-close"
              aria-label="Hide Review Changes"
              onClick={() => props.onClose?.()}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                padding: "2px",
                "border-radius": "3px",
                display: "inline-flex",
                "align-items": "center",
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </Show>
        </span>
      </header>

      <Show
        when={props.files.length > 0}
        fallback={
          <div
            data-testid="review-empty"
            style={{
              flex: "1 1 auto",
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              "justify-content": "center",
              gap: "10px",
              color: "var(--text-tertiary)",
              "font-size": "12px",
              padding: "24px 16px",
              "text-align": "center",
            }}
          >
            <FileDiff size={18} aria-hidden="true" />
            <div>No changes to review.</div>
          </div>
        }
      >
        <div style={{ padding: "12px 14px" }}>
          <textarea
            data-testid="review-commit-message"
            placeholder="Commit message…"
            value={message()}
            onInput={(e) => setMessage(e.currentTarget.value)}
            rows={3}
            style={{
              width: "100%",
              "box-sizing": "border-box",
              "background-color": "var(--bg-input)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
              "border-radius": "4px",
              padding: "8px 10px",
              "font-family": "var(--font-ui)",
              "font-size": "12px",
              "line-height": 1.45,
              resize: "vertical",
              "min-height": "60px",
            }}
          />
          <button
            type="button"
            data-testid="review-push-button"
            disabled={!canPush()}
            onClick={() => {
              if (!canPush()) return
              props.onPush?.(message())
            }}
            style={{
              width: "100%",
              "margin-top": "8px",
              padding: "9px 12px",
              "background-color": "var(--bg-2)",
              border: "1px solid var(--border-default)",
              color: "var(--text-primary)",
              "border-radius": "4px",
              "font-size": "12px",
              "font-weight": 500,
              display: "inline-flex",
              "align-items": "center",
              "justify-content": "center",
              gap: "8px",
              cursor: canPush() ? "pointer" : "not-allowed",
              opacity: canPush() ? 1 : 0.6,
              transition: "background-color var(--motion-fast), border-color var(--motion-fast)",
            }}
            onMouseEnter={(e) => {
              if (!canPush()) return
              e.currentTarget.style.backgroundColor = "var(--bg-3)"
              e.currentTarget.style.borderColor = "var(--border-emphasis)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-2)"
              e.currentTarget.style.borderColor = "var(--border-default)"
            }}
          >
            <ArrowUp size={13} aria-hidden="true" />
            <span>Push</span>
            <span
              data-testid="review-push-count"
              style={{
                color: "var(--text-tertiary)",
                "font-family": "var(--font-mono)",
                "font-size": "11px",
              }}
            >
              {props.files.length}
            </span>
          </button>
        </div>

        <div style={{ flex: "1 1 auto", overflow: "auto", padding: "0 6px 12px" }}>
          <For each={grouped()}>
            {(group) => (
              <div data-testid={`review-group-${group.dir}`}>
                <Show when={group.dir !== "."}>
                  <div
                    style={{
                      padding: "6px 10px 4px",
                      color: "var(--text-tertiary)",
                      "font-family": "var(--font-mono)",
                      "font-size": "11px",
                    }}
                  >
                    {group.dir}
                  </div>
                </Show>
                <For each={group.files}>
                  {(f) => (
                    <>
                      <FileRow
                        file={f}
                        expanded={expandedFile() === f.path}
                        loading={loadingDiff() === f.path}
                        onClick={() => toggleDiff(f.path)}
                      />
                      <Show when={expandedFile() === f.path && diffCache()[f.path]}>
                        <div
                          style={{
                            "margin-left": "4px",
                            "margin-right": "4px",
                            "margin-bottom": "8px",
                            "border-radius": "4px",
                            overflow: "hidden",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <DiffView patch={diffCache()[f.path] ?? ""} />
                        </div>
                      </Show>
                    </>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

const FileRow: Component<{
  file: ChangedFile
  expanded: boolean
  loading: boolean
  onClick: () => void
}> = (p) => {
  const Glyph = p.file.kind === "add" ? FilePlus : p.file.kind === "delete" ? FileX : FileDiff
  const tone =
    p.file.kind === "add"
      ? "var(--diff-add)"
      : p.file.kind === "delete"
        ? "var(--diff-remove)"
        : "var(--text-secondary)"
  return (
    <button
      type="button"
      class="coda-row-hover"
      data-testid={`review-file-row-${p.file.path}`}
      onClick={p.onClick}
      style={{
        width: "100%",
        display: "flex",
        "align-items": "center",
        gap: "6px",
        padding: "3px 10px",
        "font-size": "12px",
        "border-radius": "3px",
        background: p.expanded ? "var(--bg-2)" : "transparent",
        border: "none",
        color: "var(--text-primary)",
        cursor: "pointer",
        "text-align": "left",
      }}
    >
      <span style={{ "flex-shrink": "0", color: "var(--text-tertiary)" }}>
        {p.expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </span>
      <Glyph size={13} style={{ color: tone, "flex-shrink": "0" }} aria-hidden="true" />
      <span
        style={{
          flex: "1 1 auto",
          "white-space": "nowrap",
          overflow: "hidden",
          "text-overflow": "ellipsis",
        }}
      >
        {basename(p.file.path)}
      </span>
      <Show when={p.loading}>
        <span style={{ "font-size": "10px", color: "var(--text-tertiary)" }}>…</span>
      </Show>
      <span
        style={{
          "font-family": "var(--font-mono)",
          "font-size": "10px",
          color: "var(--text-tertiary)",
          "flex-shrink": "0",
        }}
      >
        <Show when={p.file.additions > 0}>
          <span style={{ color: "var(--diff-add)" }}>+{p.file.additions}</span>
        </Show>
        <Show when={p.file.deletions > 0}>
          <span style={{ color: "var(--diff-remove)", "margin-left": "4px" }}>
            −{p.file.deletions}
          </span>
        </Show>
      </span>
    </button>
  )
}

function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  return i >= 0 ? path.slice(i + 1) : path
}

function topDir(path: string): string {
  const i = path.indexOf("/")
  return i > 0 ? path.slice(0, i) : "."
}

function groupByDir(files: ChangedFile[]): Array<{ dir: string; files: ChangedFile[] }> {
  const map = new Map<string, ChangedFile[]>()
  for (const f of files) {
    const d = topDir(f.path)
    const arr = map.get(d)
    if (arr) arr.push(f)
    else map.set(d, [f])
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a === "." ? 1 : b === "." ? -1 : a.localeCompare(b)))
    .map(([dir, files]) => ({ dir, files }))
}
