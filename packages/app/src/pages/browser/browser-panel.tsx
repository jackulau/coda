import { type Component, For, Show, createSignal } from "solid-js"
import { type BrowserSettings, useSettings } from "../settings/settings-store"

export type DevTab = "console" | "network"

/**
 * Returns the list of enabled devtools tabs based on browser settings.
 * Pure function — no side effects, fully testable.
 */
export function visibleDevTabs(browser: BrowserSettings): DevTab[] {
  const tabs: DevTab[] = []
  if (browser.consolePanel) tabs.push("console")
  if (browser.networkPanel) tabs.push("network")
  return tabs
}

export interface BrowserPanelProps {
  url: string
  tabId: string
}

/**
 * Browser panel that renders a webview for the given URL.
 * Devtools tabs, element picker, and devtools toggle are controlled by settings.
 */
export const BrowserPanel: Component<BrowserPanelProps> = (props) => {
  const settings = useSettings()
  const [showDevtools, setShowDevtools] = createSignal(false)
  const [activeDevTab, setActiveDevTab] = createSignal<DevTab>("console")

  const tabs = () => visibleDevTabs(settings().browser)
  const hasAnyDevPanel = () => tabs().length > 0

  return (
    <div
      data-testid={`browser-panel-${props.tabId}`}
      style={{
        flex: "1 1 auto",
        display: "flex",
        "flex-direction": "column",
        "min-height": 0,
        "background-color": "var(--bg-0)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "6px",
          padding: "4px 8px",
          "border-bottom": "1px solid var(--border-subtle)",
          "background-color": "var(--bg-1)",
          "font-size": "12px",
        }}
      >
        {/* Element inspector button — only visible when setting enabled */}
        <Show when={settings().browser.elementInspector}>
          <button
            type="button"
            data-testid="element-picker-btn"
            title="Select element"
            style={{
              background: "none",
              border: "1px solid var(--border-default)",
              "border-radius": "4px",
              padding: "2px 6px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              "font-size": "12px",
            }}
          >
            &#8982;
          </button>
        </Show>

        <span
          style={{
            flex: 1,
            overflow: "hidden",
            "text-overflow": "ellipsis",
            "white-space": "nowrap",
            color: "var(--text-secondary)",
          }}
        >
          {props.url}
        </span>

        {/* Devtools toggle — hidden when all panels are disabled */}
        <Show when={hasAnyDevPanel()}>
          <button
            type="button"
            data-testid="devtools-toggle-btn"
            onClick={() => setShowDevtools((prev) => !prev)}
            style={{
              background: "none",
              border: "1px solid var(--border-default)",
              "border-radius": "4px",
              padding: "2px 8px",
              color: "var(--text-secondary)",
              cursor: "pointer",
              "font-size": "11px",
            }}
          >
            {showDevtools() ? "Hide DevTools" : "DevTools"}
          </button>
        </Show>
      </div>

      {/* Browser viewport */}
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          color: "var(--text-secondary)",
          "font-size": "13px",
        }}
      >
        Browser: {props.url}
      </div>

      {/* Devtools panel */}
      <Show when={showDevtools() && hasAnyDevPanel()}>
        <div
          data-testid="devtools-panel"
          style={{
            "border-top": "1px solid var(--border-subtle)",
            "background-color": "var(--bg-1)",
            height: "200px",
            display: "flex",
            "flex-direction": "column",
          }}
        >
          {/* Tab bar */}
          <div
            style={{
              display: "flex",
              gap: "0",
              "border-bottom": "1px solid var(--border-subtle)",
            }}
          >
            <For each={tabs()}>
              {(tab) => (
                <button
                  type="button"
                  data-testid={`devtab-${tab}`}
                  onClick={() => setActiveDevTab(tab)}
                  style={{
                    background: activeDevTab() === tab ? "var(--bg-2)" : "transparent",
                    border: "none",
                    "border-bottom":
                      activeDevTab() === tab
                        ? "2px solid var(--accent-500)"
                        : "2px solid transparent",
                    padding: "4px 12px",
                    color: activeDevTab() === tab ? "var(--text-primary)" : "var(--text-secondary)",
                    cursor: "pointer",
                    "font-size": "11px",
                    "text-transform": "capitalize",
                  }}
                >
                  {tab}
                </button>
              )}
            </For>
          </div>

          {/* Tab content placeholder */}
          <div
            style={{
              flex: 1,
              padding: "8px",
              "font-size": "11px",
              color: "var(--text-tertiary)",
              overflow: "auto",
            }}
          >
            {activeDevTab()} panel
          </div>
        </div>
      </Show>
    </div>
  )
}
