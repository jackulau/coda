import { Diff } from "@coda/core"
import { type Component, For, Show, createMemo } from "solid-js"

interface Props {
  patch: string
  oldPath?: string
  newPath?: string
}

const LINE_BG: Record<Diff.DiffLineKind, string> = {
  context: "transparent",
  add: "rgba(63, 185, 80, 0.10)",
  remove: "rgba(248, 81, 73, 0.10)",
}

const GUTTER_MARK: Record<Diff.DiffLineKind, string> = {
  context: " ",
  add: "+",
  remove: "-",
}

const GUTTER_COLOR: Record<Diff.DiffLineKind, string> = {
  context: "var(--text-tertiary)",
  add: "var(--diff-add)",
  remove: "var(--diff-remove)",
}

export const DiffView: Component<Props> = (props) => {
  const parsed = createMemo(() =>
    Diff.parseDiffFile(props.patch, {
      ...(props.oldPath !== undefined && { oldPath: props.oldPath }),
      ...(props.newPath !== undefined && { newPath: props.newPath }),
    }),
  )

  return (
    <div
      data-testid="diff-view"
      style={{
        "font-family": "var(--font-mono)",
        "font-size": "12px",
        "line-height": 1.5,
      }}
    >
      <header
        style={{
          padding: "8px 12px",
          background: "var(--bg-2)",
          "border-bottom": "1px solid var(--border-default)",
          color: "var(--text-primary)",
        }}
      >
        <span>{parsed().newPath ?? parsed().oldPath ?? "(unknown)"}</span>
        <span
          style={{
            "margin-left": "12px",
            color: "var(--diff-add)",
            "font-size": "11px",
          }}
        >
          +{parsed().additions}
        </span>
        <span style={{ "margin-left": "6px", color: "var(--diff-remove)", "font-size": "11px" }}>
          -{parsed().deletions}
        </span>
      </header>
      <For each={parsed().hunks}>
        {(hunk) => (
          <section data-testid="diff-hunk">
            <div
              style={{
                padding: "4px 12px",
                background: "var(--bg-1)",
                color: "var(--text-tertiary)",
                "border-top": "1px solid var(--border-subtle)",
                "border-bottom": "1px solid var(--border-subtle)",
              }}
            >
              @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@{" "}
              <Show when={hunk.header}>
                <span style={{ color: "var(--text-secondary)" }}>{hunk.header}</span>
              </Show>
            </div>
            <For each={hunk.lines}>
              {(line) => (
                <div
                  style={{
                    display: "grid",
                    "grid-template-columns": "48px 48px 24px 1fr",
                    background: LINE_BG[line.kind],
                    color: "var(--text-primary)",
                  }}
                >
                  <span
                    style={{
                      color: "var(--text-tertiary)",
                      padding: "0 6px",
                      "text-align": "right",
                    }}
                  >
                    {line.oldLine ?? ""}
                  </span>
                  <span
                    style={{
                      color: "var(--text-tertiary)",
                      padding: "0 6px",
                      "text-align": "right",
                    }}
                  >
                    {line.newLine ?? ""}
                  </span>
                  <span
                    style={{
                      color: GUTTER_COLOR[line.kind],
                      "text-align": "center",
                      "font-weight": 700,
                    }}
                  >
                    {GUTTER_MARK[line.kind]}
                  </span>
                  <span style={{ padding: "0 8px", "white-space": "pre" }}>{line.text}</span>
                </div>
              )}
            </For>
          </section>
        )}
      </For>
    </div>
  )
}
