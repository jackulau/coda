import { type Component, For, Show, createSignal } from "solid-js"
import { useLayout } from "../../context/layout"
import { useWorkspaces } from "../../context/workspace"

interface PortRow {
  port: number
  command: string
  workspaceId?: string
  external: boolean
}

const DEMO_PORTS: PortRow[] = [
  {
    port: 3000,
    command: "next dev",
    workspaceId: "10000000-0000-0000-0000-000000000001",
    external: false,
  },
  {
    port: 5173,
    command: "vite",
    workspaceId: "10000000-0000-0000-0000-000000000003",
    external: false,
  },
  { port: 8080, command: "docker-proxy (external)", external: true },
]

export const PortsPanel: Component = () => {
  const layout = useLayout()
  const ws = useWorkspaces()
  const [otherOpen, setOtherOpen] = createSignal(false)

  const focusedId = () => ws.selectedId()
  const own = () => DEMO_PORTS.filter((p) => !p.external && p.workspaceId === focusedId())
  const external = () => DEMO_PORTS.filter((p) => p.external)

  return (
    <div
      data-testid="ports-panel"
      style={{
        height: `${layout.state().portsPanelHeight}px`,
        "min-height": "120px",
        "border-top": "1px solid var(--border-subtle)",
        "background-color": "var(--bg-1)",
        display: "flex",
        "flex-direction": "column",
      }}
    >
      <div
        style={{
          padding: "8px 10px",
          "font-size": "11px",
          "letter-spacing": "0.5px",
          color: "var(--text-tertiary)",
          "text-transform": "uppercase",
        }}
      >
        Ports
      </div>
      <div style={{ flex: "1 1 auto", "overflow-y": "auto" }}>
        <For each={own()}>{(p) => <PortLine port={p} />}</For>
        <Show when={external().length > 0}>
          <button
            type="button"
            onClick={() => setOtherOpen(!otherOpen())}
            style={{
              padding: "4px 10px",
              "font-size": "11px",
              color: "var(--text-tertiary)",
              "text-align": "left",
              width: "100%",
            }}
          >
            {otherOpen() ? "▾" : "▸"} Other ({external().length})
          </button>
          <Show when={otherOpen()}>
            <For each={external()}>{(p) => <PortLine port={p} />}</For>
          </Show>
        </Show>
      </div>
    </div>
  )
}

const PortLine: Component<{ port: PortRow }> = (props) => (
  <div
    style={{
      padding: "4px 10px",
      display: "flex",
      "align-items": "center",
      gap: "8px",
      "font-size": "12px",
    }}
  >
    <span style={{ "font-family": "var(--font-mono)", color: "var(--text-primary)" }}>
      {props.port.port}
    </span>
    <span
      style={{
        color: "var(--text-secondary)",
        flex: "1 1 auto",
        "white-space": "nowrap",
        overflow: "hidden",
        "text-overflow": "ellipsis",
      }}
    >
      {props.port.command}
    </span>
    <Show when={props.port.external}>
      <span
        style={{
          color: "var(--text-tertiary)",
          "font-size": "10px",
          padding: "1px 5px",
          border: "1px solid var(--border-default)",
          "border-radius": "3px",
        }}
      >
        external
      </span>
    </Show>
  </div>
)
