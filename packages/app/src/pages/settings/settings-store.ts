import { createSignal } from "solid-js"

export interface AgentVisibility {
  claude: boolean
  codex: boolean
  gemini: boolean
  cursor: boolean
}

export interface BrowserSettings {
  enabled: boolean
  elementInspector: boolean
  consolePanel: boolean
  networkPanel: boolean
  defaultUrl: string
}

export interface ProviderKeys {
  anthropic: string
  openai: string
  google: string
  groq: string
}

export interface AgentModels {
  claude: string
  codex: string
  gemini: string
  cursor: string
}

export type DevTab = "console" | "network"

export function visibleDevTabs(browser: BrowserSettings): DevTab[] {
  const tabs: DevTab[] = []
  if (browser.consolePanel) tabs.push("console")
  if (browser.networkPanel) tabs.push("network")
  return tabs
}

export type AppearanceMode = "system" | "light" | "dark"
export type SidebarPosition = "left" | "right"
export type CursorStyle = "bar" | "block" | "underline"
export type ThemeId =
  | "vesper"
  | "oc-1"
  | "oc-2"
  | "aura"
  | "ayu"
  | "carbonfox"
  | "catppuccin"
  | "dracula"
  | "monokai"
  | "night-owl"
  | "nord"
  | "one-dark-pro"
  | "shades-of-purple"
  | "solarized"
  | "tokyonight"

export type FontFamily =
  | "JetBrains Mono"
  | "IBM Plex Mono"
  | "Cascadia Code"
  | "Fira Code"
  | "Hack"
  | "Inconsolata"
  | "Intel One Mono"
  | "Iosevka"
  | "SF Mono"
  | "Menlo"
  | "Consolas"

export type Language = "en" | "zh-CN" | "zh-TW" | "ko" | "de" | "es" | "fr"

export const THEME_OPTIONS: Array<{ id: ThemeId; label: string }> = [
  { id: "vesper", label: "Vesper" },
  { id: "oc-1", label: "OC-1" },
  { id: "oc-2", label: "OC-2" },
  { id: "aura", label: "Aura" },
  { id: "ayu", label: "Ayu" },
  { id: "carbonfox", label: "Carbonfox" },
  { id: "catppuccin", label: "Catppuccin" },
  { id: "dracula", label: "Dracula" },
  { id: "monokai", label: "Monokai" },
  { id: "night-owl", label: "Night Owl" },
  { id: "nord", label: "Nord" },
  { id: "one-dark-pro", label: "One Dark Pro" },
  { id: "shades-of-purple", label: "Shades of Purple" },
  { id: "solarized", label: "Solarized" },
  { id: "tokyonight", label: "Tokyonight" },
]

export const FONT_OPTIONS: Array<{ id: FontFamily; label: string }> = [
  { id: "JetBrains Mono", label: "JetBrains Mono" },
  { id: "IBM Plex Mono", label: "IBM Plex Mono" },
  { id: "Cascadia Code", label: "Cascadia Code" },
  { id: "Fira Code", label: "Fira Code" },
  { id: "Hack", label: "Hack" },
  { id: "Inconsolata", label: "Inconsolata" },
  { id: "Intel One Mono", label: "Intel One Mono" },
  { id: "Iosevka", label: "Iosevka" },
  { id: "SF Mono", label: "SF Mono" },
  { id: "Menlo", label: "Menlo" },
  { id: "Consolas", label: "Consolas" },
]

export const LANGUAGE_OPTIONS: Array<{ id: Language; label: string }> = [
  { id: "en", label: "English" },
  { id: "zh-CN", label: "简体中文" },
  { id: "zh-TW", label: "繁體中文" },
  { id: "ko", label: "한국어" },
  { id: "de", label: "Deutsch" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
]

export const CURSOR_STYLE_OPTIONS: Array<{ id: CursorStyle; label: string }> = [
  { id: "bar", label: "Bar" },
  { id: "block", label: "Block" },
  { id: "underline", label: "Underline" },
]

export const SCROLLBACK_OPTIONS = [1000, 5000, 10000, 25000, 50000] as const

export interface SettingsState {
  // Appearance
  language: Language
  appearance: AppearanceMode
  theme: ThemeId
  sidebarPosition: SidebarPosition
  fontFamily: FontFamily
  fontSize: number
  reducedMotion: boolean
  showReasoningSummaries: boolean

  // Terminal
  terminalFontSize: number
  terminalShell: string
  terminalCursorStyle: CursorStyle
  terminalCursorBlink: boolean
  terminalScrollback: number
  terminalStartupCommand: string
  canvasMode: boolean

  // Browser
  browser: BrowserSettings

  // Agents
  agents: AgentVisibility

  // Models — default per-agent model identifier (used by agent launchers / future model picker)
  agentModels: AgentModels

  // Providers — bring-your-own-key credentials kept locally (never sent off-device by Coda itself)
  providerKeys: ProviderKeys

  // Permissions — newline-separated glob/path/command patterns the agent must refuse
  deniedPatterns: string

  // Updates
  updatesChannel: "stable" | "beta"

  // Git
  githubPat: string
}

export const DEFAULT_SETTINGS: SettingsState = {
  language: "en",
  appearance: "dark",
  theme: "vesper",
  sidebarPosition: "left",
  fontFamily: "JetBrains Mono",
  fontSize: 13,
  reducedMotion: false,
  showReasoningSummaries: false,

  terminalFontSize: 14,
  terminalShell: "",
  terminalCursorStyle: "bar",
  terminalCursorBlink: false,
  terminalScrollback: 10000,
  terminalStartupCommand: "",
  canvasMode: false,

  browser: {
    enabled: false,
    elementInspector: false,
    consolePanel: false,
    networkPanel: false,
    defaultUrl: "",
  },

  agents: { claude: true, codex: true, gemini: true, cursor: true },

  agentModels: {
    claude: "claude-opus-4-7",
    codex: "gpt-5-codex",
    gemini: "gemini-2.5-pro",
    cursor: "auto",
  },

  providerKeys: { anthropic: "", openai: "", google: "", groq: "" },

  deniedPatterns: "",

  updatesChannel: "stable",
  githubPat: "",
}

const STORAGE_KEY = "coda.settings.v1"

function read(): SettingsState {
  if (typeof localStorage === "undefined") return DEFAULT_SETTINGS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<SettingsState>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      agents: { ...DEFAULT_SETTINGS.agents, ...(parsed.agents ?? {}) },
      browser: { ...DEFAULT_SETTINGS.browser, ...(parsed.browser ?? {}) },
      agentModels: { ...DEFAULT_SETTINGS.agentModels, ...(parsed.agentModels ?? {}) },
      providerKeys: { ...DEFAULT_SETTINGS.providerKeys, ...(parsed.providerKeys ?? {}) },
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function write(next: SettingsState): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

const [settings, setSettings] = createSignal<SettingsState>(read())

export function useSettings() {
  return settings
}

export function updateSettings(patch: Partial<SettingsState>): void {
  const next = { ...settings(), ...patch }
  setSettings(next)
  write(next)
}

export function updateAgents(patch: Partial<AgentVisibility>): void {
  const next = { ...settings(), agents: { ...settings().agents, ...patch } }
  setSettings(next)
  write(next)
}

export function updateBrowser(patch: Partial<BrowserSettings>): void {
  const next = { ...settings(), browser: { ...settings().browser, ...patch } }
  setSettings(next)
  write(next)
}

export function updateProviderKeys(patch: Partial<ProviderKeys>): void {
  const next = { ...settings(), providerKeys: { ...settings().providerKeys, ...patch } }
  setSettings(next)
  write(next)
}

export function updateAgentModels(patch: Partial<AgentModels>): void {
  const next = { ...settings(), agentModels: { ...settings().agentModels, ...patch } }
  setSettings(next)
  write(next)
}

export const MODEL_CATALOG: { agent: keyof AgentModels; label: string; models: string[] }[] = [
  {
    agent: "claude",
    label: "Claude Code",
    models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  },
  {
    agent: "codex",
    label: "Codex",
    models: ["gpt-5-codex", "gpt-5", "gpt-4.1", "gpt-4o"],
  },
  {
    agent: "gemini",
    label: "Gemini",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro"],
  },
  {
    agent: "cursor",
    label: "Cursor",
    models: ["auto", "claude-opus-4-7", "gpt-5-codex"],
  },
]
