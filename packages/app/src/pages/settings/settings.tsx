import {
  Globe,
  Keyboard,
  Monitor,
  type Paintbrush,
  Settings2,
  Shield,
  Sparkles,
  Terminal as TerminalIcon,
  X,
} from "lucide-solid"
import { type Component, For, Show, createSignal, onCleanup, onMount } from "solid-js"
import { AGENTS } from "../../components/agent-logos"
import {
  type AgentModels,
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
  MODEL_CATALOG,
  type ProviderKeys,
  SCROLLBACK_OPTIONS,
  type SettingsState,
  type SidebarPosition,
  THEME_OPTIONS,
  type ThemeId,
  updateAgentModels,
  updateAgents,
  updateBrowser,
  updateProviderKeys,
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
            Pick the default model each agent launches with. Coda passes this through when it spawns
            the agent process.
          </p>
          <For each={MODEL_CATALOG}>
            {(g) => (
              <Row label={g.label} description={`Default model identifier passed to ${g.label}.`}>
                <Select
                  testId={`settings-model-${g.agent}`}
                  value={settings().agentModels[g.agent] ?? DEFAULT_SETTINGS.agentModels[g.agent]}
                  options={g.models.map((m) => ({ id: m, label: m }))}
                  onChange={(v) => updateAgentModels({ [g.agent]: v } as Partial<AgentModels>)}
                  mono
                />
              </Row>
            )}
          </For>
        </SectionPane>

        {/* ── Providers ── */}
        <SectionPane id="providers" active={active()}>
          <SectionTitle>Providers</SectionTitle>
          <p style={hintStyle}>
            Bring-your-own-key credentials kept in this profile only. Coda never transmits these
            keys itself — agents read them at launch and call the provider directly.
          </p>
          <Row
            label="Anthropic API key"
            description="Used by Claude Code when running outside the official CLI."
          >
            <SecretField
              testId="settings-provider-anthropic"
              value={settings().providerKeys.anthropic}
              placeholder="sk-ant-…"
              onSave={(v) => updateProviderKeys({ anthropic: v.trim() })}
            />
          </Row>
          <Row label="OpenAI API key" description="Used by Codex CLI and OpenAI-compatible tools.">
            <SecretField
              testId="settings-provider-openai"
              value={settings().providerKeys.openai}
              placeholder="sk-…"
              onSave={(v) => updateProviderKeys({ openai: v.trim() })}
            />
          </Row>
          <Row label="Google AI Studio key" description="Used by Gemini CLI.">
            <SecretField
              testId="settings-provider-google"
              value={settings().providerKeys.google}
              placeholder="AIza…"
              onSave={(v) => updateProviderKeys({ google: v.trim() })}
            />
          </Row>
          <Row label="Groq API key" description="Optional fast-inference fallback.">
            <SecretField
              testId="settings-provider-groq"
              value={settings().providerKeys.groq}
              placeholder="gsk_…"
              onSave={(v) => updateProviderKeys({ groq: v.trim() })}
            />
          </Row>
        </SectionPane>

        {/* ── Permissions ── */}
        <SectionPane id="permissions" active={active()}>
          <SectionTitle>Permissions</SectionTitle>
          <p style={hintStyle}>
            Glob, path, or command patterns the coding agent must refuse. One per line. Agents read
            this list at launch and apply it as a hard denylist.
          </p>
          <Row label="Denylist" description="Examples: `**/.env`, `rm -rf /`, `~/.ssh/*`.">
            <textarea
              data-testid="settings-denylist"
              value={settings().deniedPatterns}
              placeholder={"**/.env*\nrm -rf /\n~/.ssh/*"}
              spellcheck={false}
              onChange={(e) => update({ deniedPatterns: e.currentTarget.value })}
              style={{
                width: "320px",
                "min-height": "100px",
                padding: "8px 10px",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-default)",
                "border-radius": "4px",
                "font-family": "var(--font-mono)",
                "font-size": "12px",
                "line-height": "1.5",
                resize: "vertical",
                outline: "none",
              }}
            />
          </Row>
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

const SecretField: Component<{
  testId: string
  value: string
  placeholder?: string
  onSave: (value: string) => void
}> = (props) => {
  const [local, setLocal] = createSignal(props.value)
  const [revealed, setRevealed] = createSignal(false)
  const dirty = () => local() !== props.value
  return (
    <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
      <input
        data-testid={props.testId}
        type={revealed() ? "text" : "password"}
        value={local()}
        placeholder={props.placeholder}
        autocomplete="off"
        spellcheck={false}
        onInput={(e) => setLocal(e.currentTarget.value)}
        style={{
          width: "240px",
          padding: "5px 8px",
          background: "var(--bg-input)",
          color: "var(--text-primary)",
          border: "1px solid var(--border-default)",
          "border-radius": "4px",
          "font-family": "var(--font-mono)",
          "font-size": "12px",
          outline: "none",
        }}
      />
      <button
        type="button"
        data-testid={`${props.testId}-reveal`}
        aria-label={revealed() ? "Hide key" : "Reveal key"}
        onClick={() => setRevealed((v) => !v)}
        style={{
          padding: "4px 8px",
          background: "transparent",
          border: "1px solid var(--border-default)",
          color: "var(--text-secondary)",
          "border-radius": "4px",
          "font-size": "11px",
          cursor: "pointer",
        }}
      >
        {revealed() ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        data-testid={`${props.testId}-save`}
        disabled={!dirty()}
        onClick={() => props.onSave(local())}
        style={{
          padding: "4px 10px",
          background: dirty() ? "var(--accent-500)" : "transparent",
          color: dirty() ? "#0a0a0a" : "var(--text-tertiary)",
          border: dirty() ? "1px solid transparent" : "1px solid var(--border-default)",
          "border-radius": "4px",
          "font-size": "11px",
          cursor: dirty() ? "pointer" : "default",
          transition: "background-color var(--motion-fast), color var(--motion-fast)",
        }}
      >
        Save
      </button>
    </div>
  )
}

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
