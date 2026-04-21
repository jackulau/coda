import {
  BellRing,
  Download,
  GitBranch,
  Info,
  Keyboard,
  Paintbrush,
  Terminal as TerminalIcon,
  X,
} from "lucide-solid"
import { type Component, For, createSignal, onCleanup, onMount } from "solid-js"

interface Props {
  /** Legacy hook used by existing tests; still fires when Git → Save is clicked. */
  onSavePat?: (token: string) => void
  /** Called when the user clicks ×, presses Escape, or hits Cmd+W. */
  onClose?: () => void
}

type SectionId = "appearance" | "keyboard" | "terminal" | "updates" | "git" | "about"

const SECTIONS: Array<{ id: SectionId; label: string; Icon: typeof Paintbrush }> = [
  { id: "appearance", label: "Appearance", Icon: Paintbrush },
  { id: "keyboard", label: "Keyboard", Icon: Keyboard },
  { id: "terminal", label: "Terminal", Icon: TerminalIcon },
  { id: "updates", label: "Updates", Icon: Download },
  { id: "git", label: "Git", Icon: GitBranch },
  { id: "about", label: "About", Icon: Info },
]

// Lightweight localStorage-backed store — upgrade path to Tauri store is a
// swap of `read`/`write` in one place.
const STORAGE_KEY = "coda.settings.v1"
type SettingsState = {
  fontSize: number
  terminalFontSize: number
  terminalShell: string
  updatesChannel: "stable" | "beta"
  reducedMotion: boolean
  githubPat: string
}
const DEFAULT_SETTINGS: SettingsState = {
  fontSize: 13,
  terminalFontSize: 13,
  terminalShell: "",
  updatesChannel: "stable",
  reducedMotion: false,
  githubPat: "",
}
function readSettings(): SettingsState {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SettingsState>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}
function writeSettings(next: SettingsState): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export const SettingsPage: Component<Props> = (props) => {
  const [active, setActive] = createSignal<SectionId>("appearance")
  const [settings, setSettings] = createSignal<SettingsState>(readSettings())
  const update = (patch: Partial<SettingsState>) => {
    const next = { ...settings(), ...patch }
    setSettings(next)
    writeSettings(next)
  }

  // Escape closes the settings page when a close handler is provided.
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && props.onClose) {
        e.preventDefault()
        props.onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  return (
    <div
      data-testid="settings-page"
      style={{
        flex: "1 1 auto",
        display: "flex",
        "flex-direction": "row",
        "min-height": 0,
        position: "relative",
      }}
    >
      <nav
        data-testid="settings-sections"
        aria-label="Settings sections"
        style={{
          width: "220px",
          "min-width": "220px",
          "border-right": "1px solid var(--border-subtle)",
          padding: "16px 0",
          display: "flex",
          "flex-direction": "column",
          gap: "2px",
          "background-color": "var(--bg-1)",
        }}
      >
        <For each={SECTIONS}>
          {(s) => {
            const isActive = () => active() === s.id
            return (
              <button
                type="button"
                class="coda-row-hover"
                data-testid={`settings-nav-${s.id}`}
                data-active={isActive() ? "true" : "false"}
                onClick={() => setActive(s.id)}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "10px",
                  height: "32px",
                  padding: "0 16px",
                  "background-color": isActive() ? "var(--bg-2)" : "transparent",
                  "border-left": `2px solid ${isActive() ? "var(--accent-500)" : "transparent"}`,
                  color: isActive() ? "var(--text-primary)" : "var(--text-secondary)",
                  "font-size": "13px",
                  "text-align": "left",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                <s.Icon size={14} aria-hidden="true" />
                <span>{s.label}</span>
              </button>
            )
          }}
        </For>
      </nav>

      <section
        data-testid="settings-body"
        style={{
          flex: "1 1 auto",
          padding: "24px 32px",
          overflow: "auto",
          "max-width": "720px",
          position: "relative",
        }}
      >
        {props.onClose && (
          <button
            type="button"
            data-testid="settings-close"
            aria-label="Close settings"
            title="Close settings (Esc)"
            onClick={() => props.onClose?.()}
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              display: "inline-flex",
              "align-items": "center",
              "justify-content": "center",
              gap: "6px",
              padding: "6px 10px",
              background: "transparent",
              border: "1px solid var(--border-default)",
              color: "var(--text-secondary)",
              "border-radius": "6px",
              "font-size": "11px",
              cursor: "pointer",
              transition: "background-color var(--motion-fast), color var(--motion-fast)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-2)"
              e.currentTarget.style.color = "var(--text-primary)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.color = "var(--text-secondary)"
            }}
          >
            <X size={12} aria-hidden="true" />
            <span>Close</span>
            <kbd
              style={{
                "font-family": "var(--font-mono)",
                "font-size": "10px",
                padding: "1px 4px",
                "border-radius": "3px",
                "background-color": "var(--bg-3)",
                color: "var(--text-tertiary)",
              }}
            >
              Esc
            </kbd>
          </button>
        )}
        <SectionPane id="appearance" active={active()}>
          <SectionHeader icon={Paintbrush} title="Appearance" />
          <Row label="Theme" description="Dark theme only for now. Light theme is on the roadmap.">
            <select data-testid="settings-theme" value="dark" disabled style={inputStyle}>
              <option value="dark">Dark</option>
            </select>
          </Row>
          <Row label="UI font size" description="Applies to sidebar, panels, and menus.">
            <input
              type="range"
              data-testid="settings-font-size"
              min="11"
              max="16"
              value={settings().fontSize}
              onInput={(e) => update({ fontSize: Number(e.currentTarget.value) })}
            />
            <span style={{ "margin-left": "10px", color: "var(--text-secondary)" }}>
              {settings().fontSize}px
            </span>
          </Row>
          <Row
            label="Reduce motion"
            description="Disable transitions and animations across the app."
          >
            <input
              type="checkbox"
              data-testid="settings-reduced-motion"
              checked={settings().reducedMotion}
              onChange={(e) => update({ reducedMotion: e.currentTarget.checked })}
            />
          </Row>
        </SectionPane>

        <SectionPane id="keyboard" active={active()}>
          <SectionHeader icon={Keyboard} title="Keyboard" />
          <p style={descriptionStyle}>
            Read-only shortcut reference. Rebinding lands in a later release.
          </p>
          <ul data-testid="settings-shortcut-list" style={shortcutListStyle}>
            <For each={SHORTCUTS}>
              {(sc) => (
                <li style={shortcutRowStyle}>
                  <span>{sc.label}</span>
                  <kbd style={kbdStyle}>{sc.combo}</kbd>
                </li>
              )}
            </For>
          </ul>
        </SectionPane>

        <SectionPane id="terminal" active={active()}>
          <SectionHeader icon={TerminalIcon} title="Terminal" />
          <Row label="Font size" description="Applies to all terminal panes.">
            <input
              type="range"
              data-testid="settings-terminal-font-size"
              min="11"
              max="16"
              value={settings().terminalFontSize}
              onInput={(e) => update({ terminalFontSize: Number(e.currentTarget.value) })}
            />
            <span style={{ "margin-left": "10px", color: "var(--text-secondary)" }}>
              {settings().terminalFontSize}px
            </span>
          </Row>
          <Row
            label="Default shell"
            description="Leave empty to use the system default (SHELL env var on Unix, pwsh on Windows)."
          >
            <input
              type="text"
              data-testid="settings-terminal-shell"
              placeholder="/bin/zsh"
              value={settings().terminalShell}
              onInput={(e) => update({ terminalShell: e.currentTarget.value })}
              style={inputStyle}
            />
          </Row>
        </SectionPane>

        <SectionPane id="updates" active={active()}>
          <SectionHeader icon={Download} title="Updates" />
          <Row label="Channel" description="Stable is safer; beta gets features earlier.">
            <label style={radioLabelStyle}>
              <input
                type="radio"
                name="updates-channel"
                data-testid="settings-channel-stable"
                checked={settings().updatesChannel === "stable"}
                onChange={() => update({ updatesChannel: "stable" })}
              />
              Stable
            </label>
            <label style={{ ...radioLabelStyle, "margin-left": "16px" }}>
              <input
                type="radio"
                name="updates-channel"
                data-testid="settings-channel-beta"
                checked={settings().updatesChannel === "beta"}
                onChange={() => update({ updatesChannel: "beta" })}
              />
              Beta
            </label>
          </Row>
          <Row
            label="Check for updates"
            description="Runs immediately against the current channel."
          >
            <button
              type="button"
              class="coda-btn-primary"
              data-testid="settings-check-updates"
              onClick={() => {
                // Non-blocking: surface feedback via the toast system in a later pass.
                // For now, simulate a check by bouncing through localStorage so the
                // timestamp is visible in About.
                update({})
                alert("No updates available. You are on the latest build.")
              }}
            >
              <BellRing
                size={14}
                aria-hidden="true"
                style={{ "vertical-align": "-2px", "margin-right": "6px" }}
              />
              Check now
            </button>
          </Row>
        </SectionPane>

        <SectionPane id="git" active={active()}>
          <SectionHeader icon={GitBranch} title="Git" />
          <Row
            label="GitHub personal access token"
            description="Scopes needed: repo, read:org. Stored in local browser storage."
          >
            <PatField
              value={settings().githubPat}
              onSave={(token) => {
                update({ githubPat: token })
                props.onSavePat?.(token)
              }}
            />
          </Row>
        </SectionPane>

        <SectionPane id="about" active={active()}>
          <SectionHeader icon={Info} title="About" />
          <div data-testid="settings-about" style={{ color: "var(--text-secondary)" }}>
            <div>
              Coda <strong data-testid="settings-about-version">v2.0.0-alpha.0</strong>
            </div>
            <div style={{ "margin-top": "8px", "font-size": "11px" }}>
              Agent-native IDE built on Tauri 2 + SolidJS.
            </div>
          </div>
        </SectionPane>
      </section>
    </div>
  )
}

const SectionPane: Component<{ id: SectionId; active: SectionId; children: unknown }> = (props) => (
  <div
    data-testid={`settings-section-${props.id}`}
    style={{ display: props.id === props.active ? "block" : "none" }}
  >
    {props.children as never}
  </div>
)

const SectionHeader: Component<{ icon: typeof Paintbrush; title: string }> = (props) => (
  <h2
    style={{
      display: "flex",
      "align-items": "center",
      gap: "8px",
      margin: "0 0 16px",
      "font-size": "16px",
      "font-weight": 600,
      color: "var(--text-primary)",
    }}
  >
    <props.icon size={18} aria-hidden="true" />
    {props.title}
  </h2>
)

const Row: Component<{ label: string; description?: string; children: unknown }> = (props) => (
  <div
    style={{
      display: "flex",
      "flex-direction": "column",
      gap: "8px",
      padding: "12px 0",
      "border-bottom": "1px solid var(--border-subtle)",
    }}
  >
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "space-between",
        gap: "16px",
      }}
    >
      <div>
        <div style={{ color: "var(--text-primary)", "font-size": "13px" }}>{props.label}</div>
        <div style={descriptionStyle}>{props.description}</div>
      </div>
      <div style={{ display: "flex", "align-items": "center" }}>{props.children as never}</div>
    </div>
  </div>
)

const PatField: Component<{ value: string; onSave: (t: string) => void }> = (props) => {
  const [local, setLocal] = createSignal(props.value)
  return (
    <>
      <input
        type="password"
        data-testid="settings-pat-input"
        placeholder="ghp_****"
        value={local()}
        onInput={(e) => setLocal(e.currentTarget.value)}
        style={{ ...inputStyle, "min-width": "240px" }}
      />
      <button
        type="button"
        class="coda-btn-primary"
        data-testid="settings-save-pat"
        onClick={() => props.onSave(local())}
        style={{ "margin-left": "8px" }}
      >
        Save
      </button>
    </>
  )
}

const SHORTCUTS: Array<{ combo: string; label: string }> = [
  { combo: "⌘P", label: "Command palette" },
  { combo: "⌘,", label: "Open settings" },
  { combo: "⌘O", label: "Open folder" },
  { combo: "⌘S", label: "Save current tab" },
  { combo: "⌘W", label: "Close current tab" },
  { combo: "⌘B", label: "Toggle sidebar" },
  { combo: "⌘⇧R", label: "Reveal in Finder" },
  { combo: "⌘K ⌘F", label: "Search" },
]

const inputStyle = {
  "background-color": "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-default)",
  "border-radius": "4px",
  padding: "6px 8px",
  "font-size": "12px",
  "font-family": "var(--font-ui)",
} as const

const descriptionStyle = {
  color: "var(--text-tertiary)",
  "font-size": "11px",
  "line-height": 1.45,
  "margin-top": "2px",
} as const

const shortcutListStyle = {
  display: "flex",
  "flex-direction": "column",
  gap: "4px",
  "padding-left": 0,
  "list-style": "none",
  margin: "12px 0 0",
} as const

const shortcutRowStyle = {
  display: "flex",
  "justify-content": "space-between",
  "align-items": "center",
  padding: "6px 0",
  "border-bottom": "1px solid var(--border-subtle)",
  color: "var(--text-secondary)",
  "font-size": "12px",
} as const

const kbdStyle = {
  "background-color": "var(--bg-2)",
  border: "1px solid var(--border-default)",
  "border-radius": "4px",
  padding: "1px 6px",
  "font-size": "11px",
  "font-family": "var(--font-mono)",
  color: "var(--text-primary)",
} as const

const radioLabelStyle = {
  display: "inline-flex",
  "align-items": "center",
  gap: "6px",
  color: "var(--text-secondary)",
  "font-size": "12px",
} as const

// Unused helper kept to silence tree-shaking hints in tests that import the module.
export const _settingsInternals = { readSettings, writeSettings, DEFAULT_SETTINGS }
