import { type Component, For, Show } from "solid-js"

export interface FileTreeRow {
  path: string
  name: string
  kind: "file" | "directory"
  depth: number
}

interface Props {
  rows: FileTreeRow[]
  onOpen?: (path: string) => void
}

export const FileTreePanel: Component<Props> = (props) => {
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
