import { z } from "zod"

export const SETTINGS_VERSION = 2

export const ThemeSettings = z.object({
  mode: z.enum(["dark", "light", "system"]).default("dark"),
  accent: z.enum(["orange", "blue", "green", "purple"]).default("orange"),
  fontScale: z.number().min(0.8).max(1.5).default(1),
})

export const EditorSettings = z.object({
  fontFamily: z.string().default("JetBrains Mono"),
  fontSize: z.number().int().min(10).max(24).default(13),
  tabSize: z.number().int().min(1).max(8).default(2),
  insertSpaces: z.boolean().default(true),
  wordWrap: z.boolean().default(false),
  minimap: z.boolean().default(true),
  autoSaveMs: z.number().int().min(0).max(30_000).default(800),
})

export const TerminalSettings = z.object({
  fontFamily: z.string().default("JetBrains Mono"),
  fontSize: z.number().int().min(10).max(24).default(13),
  cursorStyle: z.enum(["block", "underline", "bar"]).default("block"),
  cursorBlink: z.boolean().default(true),
  scrollback: z.number().int().min(1000).max(100_000).default(10_000),
  bellEnabled: z.boolean().default(true),
})

export const UpdatesSettings = z.object({
  channel: z.enum(["stable", "beta", "canary"]).default("stable"),
  autoInstall: z.boolean().default(false),
})

export const Settings = z.object({
  version: z.literal(SETTINGS_VERSION),
  theme: ThemeSettings,
  editor: EditorSettings,
  terminal: TerminalSettings,
  updates: UpdatesSettings,
  telemetryEnabled: z.boolean().default(true),
})

export type Settings = z.infer<typeof Settings>

export function defaultSettings(): Settings {
  return Settings.parse({
    version: SETTINGS_VERSION,
    theme: {},
    editor: {},
    terminal: {},
    updates: {},
  })
}

interface V1Shape {
  version: 1
  theme?: Partial<z.infer<typeof ThemeSettings>>
  editor?: Partial<z.infer<typeof EditorSettings>>
  telemetryEnabled?: boolean
}

export function migrate(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return defaultSettings()
  const obj = raw as { version?: unknown }
  if (obj.version === SETTINGS_VERSION) {
    return Settings.parse(raw)
  }
  if (obj.version === 1) {
    const v1 = raw as V1Shape
    return Settings.parse({
      version: SETTINGS_VERSION,
      theme: v1.theme ?? {},
      editor: v1.editor ?? {},
      terminal: {},
      updates: {},
      telemetryEnabled: v1.telemetryEnabled ?? true,
    })
  }
  return defaultSettings()
}

export function serialize(s: Settings): string {
  return JSON.stringify(Settings.parse(s), null, 2)
}

export function deserialize(json: string): Settings {
  try {
    return migrate(JSON.parse(json))
  } catch {
    return defaultSettings()
  }
}
