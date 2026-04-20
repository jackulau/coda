import { ArrowUp, FileDiff, FilePlus, FileX, GitPullRequestArrow } from "lucide-solid"
import { type Component, For, Show, createMemo, createSignal } from "solid-js"

export type ChangeKind = "add" | "modify" | "delete"

export interface ChangedFile {
  path: string
  kind: ChangeKind
  additions: number
  deletions: number
}

export interface ReviewChangesProps {
  files: ChangedFile[]
  prNumber?: number
  onPush?: (commitMessage: string) => void
}

export const ReviewChangesPanel: Component<ReviewChangesProps> = (props) => {
  const [message, setMessage] = createSignal("")
  const grouped = createMemo(() => groupByDir(props.files))
  const canPush = () => props.files.length > 0

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
                <For each={group.files}>{(f) => <FileRow file={f} />}</For>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

const FileRow: Component<{ file: ChangedFile }> = (p) => {
  const Glyph = p.file.kind === "add" ? FilePlus : p.file.kind === "delete" ? FileX : FileDiff
  const tone =
    p.file.kind === "add"
      ? "var(--diff-add)"
      : p.file.kind === "delete"
        ? "var(--diff-remove)"
        : "var(--text-secondary)"
  return (
    <div
      class="coda-row-hover"
      data-testid={`review-file-row-${p.file.path}`}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "8px",
        padding: "3px 10px",
        "font-size": "12px",
        "border-radius": "3px",
      }}
    >
      <Glyph size={13} style={{ color: tone, "flex-shrink": 0 }} aria-hidden="true" />
      <span
        style={{
          flex: "1 1 auto",
          "white-space": "nowrap",
          overflow: "hidden",
          "text-overflow": "ellipsis",
          color: "var(--text-primary)",
        }}
      >
        {basename(p.file.path)}
      </span>
      <span
        style={{
          "font-family": "var(--font-mono)",
          "font-size": "10px",
          color: "var(--text-tertiary)",
          "flex-shrink": 0,
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
    </div>
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
