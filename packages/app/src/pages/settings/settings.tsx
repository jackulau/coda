import {
  Globe,
  Keyboard,
  Monitor,
  Paintbrush,
  Settings2,
  Shield,
  Sparkles,
  Terminal as TerminalIcon,
  X,
} from "lucide-solid"
import { type Component, For, Show, createSignal, onCleanup, onMount } from "solid-js"
import { AGENTS } from "../../components/agent-logos"
import {
  type AgentVisibility,
  type AppearanceMode,
  type BrowserSettings,
  CURSOR_STYLE_OPTIONS,
  type CursorStyle,
  DEFAULT_SETTINGS,
  FONT_OPTIONS,
  type FontFamily,
  LANGUAGE_OPTIONS,
  type Language,
  SCROLLBACK_OPTIONS,
  type SettingsState,
  type SidebarPosition,
  THEME_OPTIONS,
  type ThemeId,
  updateAgents,
  updateBrowser,
  updateSettings,
  useSettings,
} from "./settings-store"

interface Props {
  onSavePat?: (token: string) => void
  onClose?: () => void
}

type SectionId =
  | "general"
  | "terminal"
  | "browser"
  | "shortcuts"
  | "models"
  | "providers"
  | "permissions"
  | "skills"

interface NavItem {
  id: SectionId
  label: string
  Icon: typeof Paintbrush
}

const DESKTOP_NAV: NavItem[] = [
  { id: "general", label: "General", Icon: Settings2 },
  { id: "terminal", label: "Terminal", Icon: TerminalIcon },
  { id: "browser", label: "Browser", Icon: Globe },
  { id: "shortcuts", label: "Shortcuts", Icon: Keyboard },
]

const SERVER_NAV: NavItem[] = [
  { id: "models", label: "Models", Icon: Sparkles },
  { id: "providers", label: "Providers", Icon: Monitor },
  { id: "permissions", label: "Permissions", Icon: Shield },
  { id: "skills", label: "Skills", Icon: Paintbrush },
]

export const SettingsPage: Component<Props> = (props) => {
  const [active, setActive] = createSignal<SectionId>("general")
  const settings = useSettings()
  const update = (patch: Partial<SettingsState>) => updateSettings(patch)
  const updateAgent = (patch: Partial<AgentVisibility>) => updateAgents(patch)
  const updateBrowserSetting = (patch: Partial<BrowserSettings>) => updateBrowser(patch)

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
      {/* ── Sidebar Nav ── */}
      <nav
        data-testid="settings-sections"
        aria-label="Settings sections"
        style={{
          width: "200px",
          "min-width": "200px",
          "border-right": "1px solid var(--border-subtle)",
          padding: "16px 0 16px",
          display: "flex",
          "flex-direction": "column",
          "background-color": "var(--bg-1)",
          "justify-content": "space-between",
        }}
      >
        <div>
          <NavGroup label="Desktop" items={DESKTOP_NAV} active={active()} onSelect={setActive} />
          <NavGroup label="Server" items={SERVER_NAV} active={active()} onSelect={setActive} />
        </div>
        <div
          style={{
            padding: "12px 16px",
            "font-size": "11px",
            color: "var(--text-tertiary)",
            "line-height": "1.5",
          }}
        >
          <div>Codaa Desktop</div>
          <div>v2.0.0-alpha.0</div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <section
        data-testid="settings-body"
        style={{
          flex: "1 1 auto",
          padding: "28px 36px",
          overflow: "auto",
          "max-width": "760px",
          position: "relative",
        }}
      >
        {/* ── General ── */}
        <SectionPane id="general" active={active()}>
          <SectionTitle>General</SectionTitle>
          <GroupTitle>Appearance</GroupTitle>

          <Row label="Language" description="Change the display language for Codaa">
            <Select
              testId="settings-language"
              value={settings().language}
              options={LANGUAGE_OPTIONS}
              onChange={(v) => update({ language: v as Language })}
            />
          </Row>

          <Row label="Appearance" description="Customise how Codaa looks on your device">
            <Select
              testId="settings-appearance"
              value={settings().appearance}
              options={[
                { id: "system", label: "System" },
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
              ]}
              onChange={(v) => update({ appearance: v as AppearanceMode })}
            />
          </Row>

          <Row label="Theme" description="Customise how Codaa is themed.">
            <Select
              testId="settings-theme"
              value={settings().theme}
              options={THEME_OPTIONS}
              onChange={(v) => update({ theme: v as ThemeId })}
            />
          </Row>

          <Row
            label="Sidebar Position"
            description="Choose which side to display the files and changes panel"
          >
            <Select
              testId="settings-sidebar-position"
              value={settings().sidebarPosition}
              options={[
                { id: "left", label: "Left" },
                { id: "right", label: "Right" },
              ]}
              onChange={(v) => update({ sidebarPosition: v as SidebarPosition })}
            />
          </Row>

          <Row label="Font" description="Customise the mono font used in code blocks">
            <Select
              testId="settings-font"
              value={settings().fontFamily}
              options={FONT_OPTIONS}
              onChange={(v) => update({ fontFamily: v as FontFamily })}
              mono
            />
          </Row>

          <GroupTitle>Feed</GroupTitle>

          <Row
            label="Show reasoning summaries"
            description="Display model reasoning summaries in the timeline"
          >
            <Toggle
              testId="settings-reasoning"
              checked={settings().showReasoningSummaries}
              onChange={(v) => update({ showReasoningSummaries: v })}
            />
          </Row>

          <Row
            label="Reduce motion"
            description="Disable transitions and animations across the app"
          >
            <Toggle
              testId="settings-reduced-motion"
              checked={settings().reducedMotion}
              onChange={(v) => update({ reducedMotion: v })}
            />
          </Row>

          <GroupTitle>Agents</GroupTitle>
          <p style={hintStyle}>
            Toggle which AI agents appear as quick-launch buttons in the terminal bar.
          </p>
          <div
            style={{
              display: "grid",
              "grid-template-columns": "1fr 1fr",
              gap: "8px",
              "margin-top": "8px",
            }}
          >
            <For each={AGENTS.filter((a) => a.kind !== "shell")}>
              {(a) => {
                const enabled = () =>
                  settings().agents[a.kind as keyof AgentVisibility] ??
                  DEFAULT_SETTINGS.agents[a.kind as keyof AgentVisibility]
                return (
                  <button
                    type="button"
                    data-testid={`settings-agent-${a.kind}`}
                    onClick={() =>
                      updateAgent({ [a.kind]: !enabled() } as Partial<AgentVisibility>)
                    }
                    style={{
                      display: "flex",
                      "align-items": "center",
                      gap: "10px",
                      padding: "10px 12px",
                      "background-color": enabled() ? "var(--bg-2)" : "transparent",
                      border: `1px solid ${enabled() ? "var(--accent-500)" : "var(--border-subtle)"}`,
                      "border-radius": "6px",
                      cursor: "pointer",
                      transition: "all var(--motion-fast)",
                      opacity: enabled() ? 1 : 0.5,
                      color: "inherit",
                    }}
                  >
                    <span class={a.className} style={{ display: "inline-flex", "font-size": "0" }}>
                      <a.logo size={22} />
                    </span>
                    <div style={{ "text-align": "left" }}>
                      <div
                        style={{
                          color: "var(--text-primary)",
                          "font-size": "13px",
                          "font-weight": "500",
                        }}
                      >
                        {a.label}
                      </div>
                      <div
                        style={{
                          color: "var(--text-tertiary)",
                          "font-size": "10px",
                          "font-family": "var(--font-mono)",
                        }}
                      >
                        {a.command}
                      </div>
                    </div>
                  </button>
                )
              }}
            </For>
          </div>

          <GroupTitle style={{ "margin-top": "28px" }}>Updates</GroupTitle>
          <Row label="Channel" description="Stable is safer; beta gets features earlier.">
            <Select
              testId="settings-channel"
              value={settings().updatesChannel}
              options={[
                { id: "stable", label: "Stable" },
                { id: "beta", label: "Beta" },
              ]}
              onChange={(v) => update({ updatesChannel: v as "stable" | "beta" })}
            />
          </Row>

          <GroupTitle style={{ "margin-top": "28px" }}>Git</GroupTitle>
          <Row
            label="GitHub personal access token"
            description="Scopes needed: repo, read:org. Stored locally."
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

        {/* ── Terminal ── */}
        <SectionPane id="terminal" active={active()}>
          <SectionTitle>Terminal</SectionTitle>

          <Row label="Font Size" description="The font size used in the terminal">
            <Select
              testId="settings-terminal-font-size"
              value={String(settings().terminalFontSize)}
              options={[11, 12, 13, 14, 15, 16].map((n) => ({
                id: String(n),
                label: `${n}px`,
              }))}
              onChange={(v) => update({ terminalFontSize: Number(v) })}
            />
          </Row>

          <Row label="Cursor Style" description="The style of the terminal cursor">
            <Select
              testId="settings-cursor-style"
              value={settings().terminalCursorStyle}
              options={CURSOR_STYLE_OPTIONS}
              onChange={(v) => update({ terminalCursorStyle: v as CursorStyle })}
            />
          </Row>

          <Row label="Cursor Blink" description="Whether the terminal cursor blinks when focused">
            <Toggle
              testId="settings-cursor-blink"
              checked={settings().terminalCursorBlink}
              onChange={(v) => update({ terminalCursorBlink: v })}
            />
          </Row>

          <Row
            label="Scrollback"
            description="Maximum number of lines stored in the terminal buffer"
          >
            <Select
              testId="settings-scrollback"
              value={String(settings().terminalScrollback)}
              options={SCROLLBACK_OPTIONS.map((n) => ({
                id: String(n),
                label: n.toLocaleString(),
              }))}
              onChange={(v) => update({ terminalScrollback: Number(v) })}
            />
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
              style={textInputStyle}
            />
          </Row>

          <Row
            label="Startup Command"
            description="Command to run automatically when a new terminal is opened"
          >
            <input
              type="text"
              data-testid="settings-startup-command"
              placeholder="claude --effort max"
              value={settings().terminalStartupCommand}
              onInput={(e) => update({ terminalStartupCommand: e.currentTarget.value })}
              style={{ ...textInputStyle, "min-width": "220px" }}
            />
          </Row>

          <Row
            label="Canvas mode"
            description="Turn the terminal dock into a pannable canvas with free-moving windows."
          >
            <Toggle
              testId="settings-canvas-mode"
              checked={settings().canvasMode}
              onChange={(v) => update({ canvasMode: v })}
            />
          </Row>
        </SectionPane>

        {/* ── Browser ── */}
        <SectionPane id="browser" active={active()}>
          <SectionTitle>Browser</SectionTitle>

          <Row
            label="Enable Browser"
            description="Show the integrated browser panel in the sandbox environment. Works with any website — no installation required."
          >
            <Toggle
              testId="settings-browser-enabled"
              checked={settings().browser.enabled}
              onChange={(v) => updateBrowserSetting({ enabled: v })}
            />
          </Row>

          <Row
            label="Element Inspector"
            description="Enable the element inspector tool for picking and inspecting elements on any page"
          >
            <Toggle
              testId="settings-browser-inspector"
              checked={settings().browser.elementInspector}
              onChange={(v) => updateBrowserSetting({ elementInspector: v })}
            />
          </Row>

          <Row label="Console Panel" description="Show captured console logs from browsed pages">
            <Toggle
              testId="settings-browser-console"
              checked={settings().browser.consolePanel}
              onChange={(v) => updateBrowserSetting({ consolePanel: v })}
            />
          </Row>

          <Row
            label="Network Panel"
            description="Show captured network requests from browsed pages"
          >
            <Toggle
              testId="settings-browser-network"
              checked={settings().browser.networkPanel}
              onChange={(v) => updateBrowserSetting({ networkPanel: v })}
            />
          </Row>

          <Row
            label="Default URL"
            description="URL to load when opening the browser panel (leave empty for about:blank)"
          >
            <input
              type="text"
              data-testid="settings-browser-url"
              placeholder="e.g. http://localhost:3000"
              value={settings().browser.defaultUrl}
              onInput={(e) => updateBrowserSetting({ defaultUrl: e.currentTarget.value })}
              style={{ ...textInputStyle, "min-width": "240px" }}
            />
          </Row>

          <GroupTitle style={{ "margin-top": "28px" }}>Design Mode</GroupTitle>
          <p style={hintStyle}>
            When enabled, agents can see your running app, inspect elements, and edit source code
            directly from the browser panel. Changes appear instantly via HMR.
          </p>
        </SectionPane>

        {/* ── Shortcuts ── */}
        <SectionPane id="shortcuts" active={active()}>
          <SectionTitle>Shortcuts</SectionTitle>
          <p style={hintStyle}>Read-only shortcut reference. Rebinding is on the roadmap.</p>
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

        {/* ── Models ── */}
        <SectionPane id="models" active={active()}>
          <SectionTitle>Models</SectionTitle>
          <p style={hintStyle}>
            Configure which AI models each agent uses. Set default models, temperature, and context
            window preferences per workspace.
          </p>
          <ComingSoonSection
            icon={Sparkles}
            title="Model configuration"
            lines={[
              "Choose default models for each agent (Claude, Codex, Gemini, Cursor)",
              "Set temperature, max tokens, and context window per model",
              "Compare model performance across your coding tasks",
            ]}
          />
        </SectionPane>

        {/* ── Providers ── */}
        <SectionPane id="providers" active={active()}>
          <SectionTitle>Providers</SectionTitle>
          <p style={hintStyle}>
            Manage API providers and their credentials. Bring your own keys or connect through
            OAuth.
          </p>
          <ComingSoonSection
            icon={Monitor}
            title="Provider management"
            lines={[
              "Add API keys for Anthropic, OpenAI, Google, and more",
              "OAuth-based authentication for supported providers",
              "Usage tracking and rate-limit monitoring per provider",
            ]}
          />
        </SectionPane>

        {/* ── Permissions ── */}
        <SectionPane id="permissions" active={active()}>
          <SectionTitle>Permissions</SectionTitle>
          <p style={hintStyle}>
            Control what the coding agent is allowed to do — file access, terminal commands, and
            network calls.
          </p>
          <ComingSoonSection
            icon={Shield}
            title="Permission controls"
            lines={[
              "Allow or deny file read/write by path pattern",
              "Restrict terminal commands and executables",
              "Control network access and allowed domains",
            ]}
          />
        </SectionPane>

        {/* ── Skills ── */}
        <SectionPane id="skills" active={active()}>
          <SectionTitle>Skills</SectionTitle>
          <p style={hintStyle}>
            Browse and manage reusable skills the coding agent can invoke — linting, testing,
            deploying, and more.
          </p>
          <ComingSoonSection
            icon={Paintbrush}
            title="Skill registry"
            lines={[
              "Discover built-in skills for common workflows",
              "Create custom skills from prompts or scripts",
              "Enable or disable skills per workspace",
            ]}
          />
        </SectionPane>
      </section>

      {/* ── Close Button ── */}
      <Show when={props.onClose}>
        <button
          type="button"
          data-testid="settings-close"
          aria-label="Close settings"
          title="Close settings (Esc)"
          onClick={() => props.onClose?.()}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            width: "28px",
            height: "28px",
            background: "transparent",
            border: "1px solid var(--border-default)",
            color: "var(--text-secondary)",
            "border-radius": "6px",
            cursor: "pointer",
            transition: "background-color var(--motion-fast), color var(--motion-fast)",
            "z-index": "10",
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
          <X size={14} aria-hidden="true" />
        </button>
      </Show>
    </div>
  )
}

/* ─────────────────────── Shared Subcomponents ─────────────────────── */

const NavGroup: Component<{
  label: string
  items: NavItem[]
  active: SectionId
  onSelect: (id: SectionId) => void
}> = (props) => (
  <div style={{ "margin-bottom": "8px" }}>
    <div
      style={{
        padding: "6px 16px",
        "font-size": "10px",
        "font-weight": "600",
        "text-transform": "uppercase",
        "letter-spacing": "0.05em",
        color: "var(--text-tertiary)",
        "margin-top": "8px",
      }}
    >
      {props.label}
    </div>
    <For each={props.items}>
      {(item) => {
        const isActive = () => props.active === item.id
        return (
          <button
            type="button"
            data-testid={`settings-nav-${item.id}`}
            data-active={isActive() ? "true" : "false"}
            onClick={() => props.onSelect(item.id)}
            style={{
              display: "flex",
              "align-items": "center",
              gap: "10px",
              width: "100%",
              height: "32px",
              padding: "0 16px",
              "background-color": isActive() ? "var(--bg-2)" : "transparent",
              border: "none",
              color: isActive() ? "var(--text-primary)" : "var(--text-secondary)",
              "font-size": "13px",
              "text-align": "left",
              cursor: "pointer",
              transition: "background-color var(--motion-fast)",
              "border-radius": "0",
            }}
            onMouseEnter={(e) => {
              if (!isActive()) e.currentTarget.style.backgroundColor = "var(--bg-2)"
            }}
            onMouseLeave={(e) => {
              if (!isActive()) e.currentTarget.style.backgroundColor = "transparent"
            }}
          >
            <item.Icon size={14} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        )
      }}
    </For>
  </div>
)

const SectionPane: Component<{ id: SectionId; active: SectionId; children: unknown }> = (props) => (
  <div
    data-testid={`settings-section-${props.id}`}
    style={{ display: props.id === props.active ? "block" : "none" }}
  >
    {props.children as never}
  </div>
)

const SectionTitle: Component<{ children: unknown }> = (props) => (
  <h2
    style={{
      margin: "0 0 20px",
      "font-size": "20px",
      "font-weight": 600,
      color: "var(--text-primary)",
    }}
  >
    {props.children as never}
  </h2>
)

const GroupTitle: Component<{ children: unknown; style?: Record<string, string> }> = (props) => (
  <h3
    style={{
      margin: "24px 0 12px",
      "font-size": "14px",
      "font-weight": 600,
      color: "var(--text-primary)",
      ...(props.style ?? {}),
    }}
  >
    {props.children as never}
  </h3>
)

const Row: Component<{ label: string; description?: string; children: unknown }> = (props) => (
  <div style={rowStyle}>
    <div style={{ flex: "1 1 0", "min-width": 0 }}>
      <div style={{ color: "var(--text-primary)", "font-size": "13px" }}>{props.label}</div>
      <Show when={props.description}>
        <div style={descriptionStyle}>{props.description}</div>
      </Show>
    </div>
    <div style={{ display: "flex", "align-items": "center", "flex-shrink": 0 }}>
      {props.children as never}
    </div>
  </div>
)

const Select: Component<{
  testId: string
  value: string
  options: Array<{ id: string; label: string }>
  onChange: (value: string) => void
  mono?: boolean
}> = (props) => (
  <select
    data-testid={props.testId}
    value={props.value}
    onChange={(e) => props.onChange(e.currentTarget.value)}
    style={{
      ...selectStyle,
      "font-family": props.mono ? "var(--font-mono)" : "var(--font-ui)",
    }}
  >
    <For each={props.options}>{(opt) => <option value={opt.id}>{opt.label}</option>}</For>
  </select>
)

const Toggle: Component<{
  testId: string
  checked: boolean
  onChange: (v: boolean) => void
}> = (props) => (
  <button
    type="button"
    role="switch"
    aria-checked={props.checked}
    data-testid={props.testId}
    onClick={() => props.onChange(!props.checked)}
    style={{
      position: "relative",
      width: "36px",
      height: "20px",
      "border-radius": "10px",
      border: "none",
      "background-color": props.checked ? "var(--accent-500)" : "var(--bg-3)",
      cursor: "pointer",
      transition: "background-color var(--motion-fast)",
      padding: 0,
      "flex-shrink": "0",
    }}
  >
    <span
      style={{
        position: "absolute",
        top: "2px",
        left: props.checked ? "18px" : "2px",
        width: "16px",
        height: "16px",
        "border-radius": "50%",
        "background-color": "#fff",
        transition: "left var(--motion-fast)",
        "box-shadow": "0 1px 3px rgba(0,0,0,0.3)",
      }}
    />
  </button>
)

const ComingSoonSection: Component<{
  icon: typeof Sparkles
  title: string
  lines: string[]
}> = (props) => (
  <div
    style={{
      padding: "24px",
      "border-radius": "8px",
      border: "1px solid var(--border-subtle)",
      "background-color": "var(--bg-1)",
    }}
  >
    <div style={{ display: "flex", "align-items": "center", gap: "10px", "margin-bottom": "16px" }}>
      <div
        style={{
          width: "32px",
          height: "32px",
          "border-radius": "8px",
          "background-color": "var(--bg-3)",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          color: "var(--text-tertiary)",
        }}
      >
        <props.icon size={16} />
      </div>
      <div>
        <div style={{ color: "var(--text-primary)", "font-size": "13px", "font-weight": "500" }}>
          {props.title}
        </div>
        <div
          style={{
            color: "var(--accent-500)",
            "font-size": "10px",
            "font-weight": "600",
            "text-transform": "uppercase",
            "letter-spacing": "0.05em",
          }}
        >
          Coming soon
        </div>
      </div>
    </div>
    <ul
      style={{
        margin: 0,
        "padding-left": "20px",
        display: "flex",
        "flex-direction": "column",
        gap: "6px",
      }}
    >
      <For each={props.lines}>
        {(line) => (
          <li style={{ color: "var(--text-secondary)", "font-size": "12px", "line-height": "1.5" }}>
            {line}
          </li>
        )}
      </For>
    </ul>
  </div>
)

const PatField: Component<{ value: string; onSave: (t: string) => void }> = (props) => {
  const [local, setLocal] = createSignal(props.value)
  return (
    <div style={{ display: "flex", "align-items": "center", gap: "8px" }}>
      <input
        type="password"
        data-testid="settings-pat-input"
        placeholder="ghp_****"
        value={local()}
        onInput={(e) => setLocal(e.currentTarget.value)}
        style={{ ...textInputStyle, "min-width": "200px" }}
      />
      <button
        type="button"
        class="coda-btn-primary"
        data-testid="settings-save-pat"
        onClick={() => props.onSave(local())}
      >
        Save
      </button>
    </div>
  )
}

/* ─────────────────────── Data ─────────────────────── */

const SHORTCUTS: Array<{ combo: string; label: string }> = [
  { combo: "⌘P", label: "Command palette" },
  { combo: "⌘,", label: "Open settings" },
  { combo: "⌘O", label: "Open folder" },
  { combo: "⌘S", label: "Save current tab" },
  { combo: "⌘W", label: "Close current tab" },
  { combo: "⌘B", label: "Toggle sidebar" },
  { combo: "⌘`", label: "Toggle terminal" },
  { combo: "⌘J", label: "Toggle terminal" },
  { combo: "⌘⇧R", label: "Reveal in Finder" },
  { combo: "⌘K ⌘F", label: "Search" },
]

/* ─────────────────────── Styles ─────────────────────── */

const rowStyle = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  gap: "24px",
  padding: "12px 0",
  "border-bottom": "1px solid var(--border-subtle)",
} as const

const selectStyle = {
  "background-color": "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-default)",
  "border-radius": "6px",
  padding: "6px 28px 6px 10px",
  "font-size": "13px",
  "min-width": "140px",
  cursor: "pointer",
  appearance: "none" as const,
  "background-image": `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239a9aa6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 15 5 5 5-5'/%3E%3Cpath d='m7 9 5-5 5 5'/%3E%3C/svg%3E")`,
  "background-repeat": "no-repeat",
  "background-position": "right 8px center",
} as const

const textInputStyle = {
  "background-color": "var(--bg-input)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-default)",
  "border-radius": "6px",
  padding: "6px 10px",
  "font-size": "13px",
  "font-family": "var(--font-mono)",
  "min-width": "180px",
} as const

const descriptionStyle = {
  color: "var(--text-tertiary)",
  "font-size": "11px",
  "line-height": "1.45",
  "margin-top": "2px",
} as const

const hintStyle = {
  color: "var(--text-tertiary)",
  "font-size": "12px",
  "line-height": "1.5",
  margin: "0 0 16px",
} as const

const shortcutListStyle = {
  display: "flex",
  "flex-direction": "column",
  gap: "0",
  "padding-left": "0",
  "list-style": "none",
  margin: "12px 0 0",
} as const

const shortcutRowStyle = {
  display: "flex",
  "justify-content": "space-between",
  "align-items": "center",
  padding: "8px 0",
  "border-bottom": "1px solid var(--border-subtle)",
  color: "var(--text-secondary)",
  "font-size": "13px",
} as const

const kbdStyle = {
  "background-color": "var(--bg-2)",
  border: "1px solid var(--border-default)",
  "border-radius": "4px",
  padding: "2px 8px",
  "font-size": "12px",
  "font-family": "var(--font-mono)",
  color: "var(--text-primary)",
} as const

export { DEFAULT_SETTINGS, updateSettings, useSettings } from "./settings-store"
