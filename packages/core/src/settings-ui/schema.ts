import { z } from "zod"

export const SettingsCategory = z.enum([
  "general",
  "appearance",
  "editor",
  "terminal",
  "agents",
  "github",
  "updates",
  "a11y",
  "debug",
])
export type SettingsCategory = z.infer<typeof SettingsCategory>

export interface SettingEntry<T = unknown> {
  key: string
  category: SettingsCategory
  label: string
  description: string
  type: "boolean" | "number" | "string" | "select" | "keybinding"
  default: T
  options?: readonly string[]
  min?: number
  max?: number
  restartRequired?: boolean
}

export const SETTINGS_CATALOG: readonly SettingEntry[] = [
  {
    key: "appearance.theme",
    category: "appearance",
    label: "Theme",
    description: "Pick the IDE color theme.",
    type: "select",
    default: "dark",
    options: ["dark", "light", "system"],
  },
  {
    key: "editor.fontSize",
    category: "editor",
    label: "Editor font size",
    description: "",
    type: "number",
    default: 14,
    min: 10,
    max: 24,
  },
  {
    key: "editor.autoSave",
    category: "editor",
    label: "Auto-save",
    description: "Auto-save after 500 ms of no typing.",
    type: "boolean",
    default: true,
  },
  {
    key: "terminal.fontSize",
    category: "terminal",
    label: "Terminal font size",
    description: "",
    type: "number",
    default: 14,
    min: 10,
    max: 24,
  },
  {
    key: "terminal.scrollback",
    category: "terminal",
    label: "Terminal scrollback",
    description: "",
    type: "number",
    default: 10_000,
    min: 1000,
    max: 100_000,
  },
  {
    key: "agents.defaultKind",
    category: "agents",
    label: "Default agent",
    description: "",
    type: "select",
    default: "claude-code",
    options: ["claude-code", "codex", "copilot", "gemini", "amp"],
  },
  {
    key: "github.pat",
    category: "github",
    label: "GitHub personal access token",
    description: "Stored in OS keychain; never persisted in plaintext.",
    type: "string",
    default: "",
  },
  {
    key: "updates.channel",
    category: "updates",
    label: "Update channel",
    description: "",
    type: "select",
    default: "stable",
    options: ["stable", "beta", "canary"],
  },
  {
    key: "a11y.reducedMotion",
    category: "a11y",
    label: "Reduced motion",
    description: "Disables non-essential animations.",
    type: "boolean",
    default: false,
  },
  {
    key: "debug.enableTracing",
    category: "debug",
    label: "Enable tracing",
    description: "Emit detailed traces to ~/.coda/logs.",
    type: "boolean",
    default: false,
    restartRequired: true,
  },
] as const

export function byCategory(): Record<SettingsCategory, SettingEntry[]> {
  const out: Record<SettingsCategory, SettingEntry[]> = {
    general: [],
    appearance: [],
    editor: [],
    terminal: [],
    agents: [],
    github: [],
    updates: [],
    a11y: [],
    debug: [],
  }
  for (const entry of SETTINGS_CATALOG) out[entry.category].push(entry)
  return out
}

export function validateValue(entry: SettingEntry, value: unknown): true | string {
  switch (entry.type) {
    case "boolean":
      return typeof value === "boolean" || "must be boolean"
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) return "must be number"
      if (entry.min !== undefined && value < entry.min) return `must be ≥ ${entry.min}`
      if (entry.max !== undefined && value > entry.max) return `must be ≤ ${entry.max}`
      return true
    }
    case "select":
      return (
        (Array.isArray(entry.options) && entry.options.includes(String(value))) ||
        `must be one of ${entry.options?.join(", ")}`
      )
    case "string":
      return typeof value === "string" || "must be string"
    case "keybinding":
      return (
        (typeof value === "string" &&
          z
            .string()
            .regex(/[A-Za-z0-9+\-. ]+/)
            .safeParse(value).success) ||
        "invalid keybinding"
      )
  }
}

export function applyDefaults(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const entry of SETTINGS_CATALOG) out[entry.key] = entry.default
  return out
}

export function findEntry(key: string): SettingEntry | undefined {
  return SETTINGS_CATALOG.find((e) => e.key === key)
}
