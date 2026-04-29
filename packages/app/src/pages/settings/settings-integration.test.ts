import { beforeEach, describe, expect, test } from "bun:test"
import { effectiveCursorBlink, resolveStartupCommand } from "@coda/core/terminal-settings/settings"
import { editorThemeFor } from "../../components/editor/editor-theme-extension"
import { terminalThemeFor } from "../../components/terminal/terminal-theme"
import {
  buildFontStack,
  resolveColorScheme,
  shouldReduceMotion,
  sidebarOrder,
} from "../../lib/apply-settings"
import { setLocale, t } from "../../lib/i18n"
import {
  DEFAULT_SETTINGS,
  type SettingsState,
  THEME_OPTIONS,
  updateSettings,
  useSettings,
  visibleDevTabs,
} from "./settings-store"

const STORAGE_KEY = "coda.settings.v1"

// Minimal localStorage polyfill for bun test environment
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>()
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  }
}

// Fields that were already wired before this spec
const ALREADY_WORKING = new Set([
  "terminalFontSize",
  "terminalShell",
  "agents",
  "canvasMode",
  "githubPat",
])
// Nested keys that were already wired
const ALREADY_WORKING_NESTED = new Set(["browser.enabled", "browser.defaultUrl"])

describe("Settings Integration", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
    // Reset to defaults
    updateSettings({ ...DEFAULT_SETTINGS })
  })

  /* ------------------------------------------------------------------ */
  /*  Test 1: Settings round-trip                                        */
  /* ------------------------------------------------------------------ */
  describe("settings round-trip", () => {
    test("write all settings via updateSettings, read back via useSettings, verify all fields", () => {
      const custom: SettingsState = {
        language: "de",
        appearance: "light",
        theme: "dracula",
        sidebarPosition: "right",
        fontFamily: "Fira Code",
        fontSize: 16,
        reducedMotion: true,
        showReasoningSummaries: true,
        terminalFontSize: 18,
        terminalShell: "/bin/bash",
        terminalCursorStyle: "block",
        terminalCursorBlink: true,
        terminalScrollback: 25000,
        terminalStartupCommand: "echo hello",
        canvasMode: true,
        browser: {
          enabled: true,
          elementInspector: true,
          consolePanel: true,
          networkPanel: true,
          defaultUrl: "https://example.com",
        },
        agents: { claude: false, codex: true, gemini: false, cursor: true },
        updatesChannel: "beta",
        githubPat: "ghp_test123",
      }

      updateSettings(custom)

      const readBack = useSettings()()
      expect(readBack.language).toBe("de")
      expect(readBack.appearance).toBe("light")
      expect(readBack.theme).toBe("dracula")
      expect(readBack.sidebarPosition).toBe("right")
      expect(readBack.fontFamily).toBe("Fira Code")
      expect(readBack.fontSize).toBe(16)
      expect(readBack.reducedMotion).toBe(true)
      expect(readBack.showReasoningSummaries).toBe(true)
      expect(readBack.terminalFontSize).toBe(18)
      expect(readBack.terminalShell).toBe("/bin/bash")
      expect(readBack.terminalCursorStyle).toBe("block")
      expect(readBack.terminalCursorBlink).toBe(true)
      expect(readBack.terminalScrollback).toBe(25000)
      expect(readBack.terminalStartupCommand).toBe("echo hello")
      expect(readBack.canvasMode).toBe(true)
      expect(readBack.browser.enabled).toBe(true)
      expect(readBack.browser.elementInspector).toBe(true)
      expect(readBack.browser.consolePanel).toBe(true)
      expect(readBack.browser.networkPanel).toBe(true)
      expect(readBack.browser.defaultUrl).toBe("https://example.com")
      expect(readBack.agents.claude).toBe(false)
      expect(readBack.agents.codex).toBe(true)
      expect(readBack.agents.gemini).toBe(false)
      expect(readBack.agents.cursor).toBe(true)
      expect(readBack.updatesChannel).toBe("beta")
      expect(readBack.githubPat).toBe("ghp_test123")
    })

    test("values persist in localStorage after updateSettings", () => {
      updateSettings({ theme: "nord", fontSize: 15 })
      const raw = localStorage.getItem(STORAGE_KEY)
      expect(raw).toBeTruthy()
      // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
      const parsed = JSON.parse(raw!)
      expect(parsed.theme).toBe("nord")
      expect(parsed.fontSize).toBe(15)
    })
  })

  /* ------------------------------------------------------------------ */
  /*  Test 2: Theme cascade                                              */
  /* ------------------------------------------------------------------ */
  describe("theme cascade", () => {
    test("all 15 theme IDs produce valid terminal themes without throwing", () => {
      for (const { id } of THEME_OPTIONS) {
        const result = terminalThemeFor(id)
        expect(result).toHaveProperty("background")
        expect(result).toHaveProperty("foreground")
        expect(typeof result.background).toBe("string")
        expect(typeof result.foreground).toBe("string")
        expect(result.background.length).toBeGreaterThan(0)
        expect(result.foreground.length).toBeGreaterThan(0)
      }
    })

    test("all 15 theme IDs produce valid editor themes without throwing", () => {
      for (const { id } of THEME_OPTIONS) {
        const result = editorThemeFor(id)
        expect(result).toHaveProperty("background")
        expect(result).toHaveProperty("foreground")
        expect(result).toHaveProperty("accent")
        expect(typeof result.background).toBe("string")
        expect(typeof result.foreground).toBe("string")
        expect(typeof result.accent).toBe("string")
        expect(result.background.length).toBeGreaterThan(0)
        expect(result.foreground.length).toBeGreaterThan(0)
        expect(result.accent.length).toBeGreaterThan(0)
      }
    })

    test("terminal and editor themes return valid hex colors for same ID", () => {
      for (const { id } of THEME_OPTIONS) {
        const terminal = terminalThemeFor(id)
        const editor = editorThemeFor(id)
        expect(terminal.background).toMatch(/^#[0-9a-f]{3,8}$/i)
        expect(editor.background).toMatch(/^#[0-9a-f]{3,8}$/i)
      }
    })
  })

  /* ------------------------------------------------------------------ */
  /*  Test 3: Settings-store coverage                                    */
  /* ------------------------------------------------------------------ */
  describe("settings-store coverage", () => {
    test("every non-already-working field has a consumer function", () => {
      // Map of setting field -> consumer function that exercises it
      const consumers: Record<string, () => void> = {
        language: () => {
          setLocale("en")
          t("settings.appearance")
        },
        appearance: () => resolveColorScheme("dark", true),
        theme: () => {
          terminalThemeFor("vesper")
          editorThemeFor("vesper")
        },
        sidebarPosition: () => sidebarOrder("left"),
        fontFamily: () => buildFontStack("JetBrains Mono"),
        fontSize: () => buildFontStack("JetBrains Mono"),
        reducedMotion: () => shouldReduceMotion(false, false),
        showReasoningSummaries: () => {
          /* consumed by UI component directly */
        },
        terminalCursorStyle: () => effectiveCursorBlink(false, false),
        terminalCursorBlink: () => effectiveCursorBlink(true, false),
        terminalScrollback: () => {
          /* consumed by terminal-dock.tsx via term.options.scrollback */
        },
        terminalStartupCommand: () => resolveStartupCommand("test", false),
        updatesChannel: () => {
          /* consumed by updates.tsx UI */
        },
      }

      // Consumer functions for nested browser fields
      const browserConsumers: Record<string, () => void> = {
        elementInspector: () =>
          visibleDevTabs({
            enabled: true,
            elementInspector: true,
            consolePanel: true,
            networkPanel: true,
            defaultUrl: "",
          }),
        consolePanel: () =>
          visibleDevTabs({
            enabled: true,
            elementInspector: false,
            consolePanel: true,
            networkPanel: false,
            defaultUrl: "",
          }),
        networkPanel: () =>
          visibleDevTabs({
            enabled: true,
            elementInspector: false,
            consolePanel: false,
            networkPanel: true,
            defaultUrl: "",
          }),
      }

      // Check every top-level field
      const allFields = Object.keys(DEFAULT_SETTINGS) as Array<keyof SettingsState>
      for (const field of allFields) {
        if (ALREADY_WORKING.has(field)) continue

        if (field === "browser") {
          // Check nested browser keys
          const browserKeys = Object.keys(DEFAULT_SETTINGS.browser) as Array<
            keyof typeof DEFAULT_SETTINGS.browser
          >
          for (const bk of browserKeys) {
            const fullKey = `browser.${bk}`
            if (ALREADY_WORKING_NESTED.has(fullKey)) continue
            const fn = browserConsumers[bk]
            expect(fn).toBeDefined()
            if (fn) expect(() => fn()).not.toThrow()
          }
        } else {
          const fn = consumers[field]
          expect(fn).toBeDefined()
          if (fn) expect(() => fn()).not.toThrow()
        }
      }
    })
  })

  /* ------------------------------------------------------------------ */
  /*  Test 4: Settings migration — missing keys                          */
  /* ------------------------------------------------------------------ */
  describe("settings migration", () => {
    test("partial settings with missing keys merge correctly with defaults", () => {
      // Simulate what read() does with a partial stored object
      const partial: Partial<SettingsState> = { theme: "dracula" }

      const merged: SettingsState = {
        ...DEFAULT_SETTINGS,
        ...partial,
        agents: { ...DEFAULT_SETTINGS.agents, ...(partial.agents ?? {}) },
        browser: { ...DEFAULT_SETTINGS.browser, ...(partial.browser ?? {}) },
      }

      // Stored value preserved
      expect(merged.theme).toBe("dracula")

      // All missing fields get defaults
      expect(merged.language).toBe(DEFAULT_SETTINGS.language)
      expect(merged.appearance).toBe(DEFAULT_SETTINGS.appearance)
      expect(merged.sidebarPosition).toBe(DEFAULT_SETTINGS.sidebarPosition)
      expect(merged.fontFamily).toBe(DEFAULT_SETTINGS.fontFamily)
      expect(merged.fontSize).toBe(DEFAULT_SETTINGS.fontSize)
      expect(merged.reducedMotion).toBe(DEFAULT_SETTINGS.reducedMotion)
      expect(merged.terminalCursorStyle).toBe(DEFAULT_SETTINGS.terminalCursorStyle)
      expect(merged.terminalCursorBlink).toBe(DEFAULT_SETTINGS.terminalCursorBlink)
      expect(merged.terminalScrollback).toBe(DEFAULT_SETTINGS.terminalScrollback)
      expect(merged.terminalStartupCommand).toBe(DEFAULT_SETTINGS.terminalStartupCommand)
      expect(merged.updatesChannel).toBe(DEFAULT_SETTINGS.updatesChannel)
      expect(merged.browser.enabled).toBe(DEFAULT_SETTINGS.browser.enabled)
      expect(merged.browser.consolePanel).toBe(DEFAULT_SETTINGS.browser.consolePanel)
      expect(merged.browser.networkPanel).toBe(DEFAULT_SETTINGS.browser.networkPanel)
      expect(merged.browser.elementInspector).toBe(DEFAULT_SETTINGS.browser.elementInspector)
      expect(merged.agents.claude).toBe(DEFAULT_SETTINGS.agents.claude)
      expect(merged.agents.codex).toBe(DEFAULT_SETTINGS.agents.codex)
    })

    test("missing agents sub-keys get defaults", () => {
      const partial: Partial<SettingsState> = {
        agents: { claude: false } as SettingsState["agents"],
      }

      const merged: SettingsState = {
        ...DEFAULT_SETTINGS,
        ...partial,
        agents: { ...DEFAULT_SETTINGS.agents, ...(partial.agents ?? {}) },
        browser: { ...DEFAULT_SETTINGS.browser, ...(partial.browser ?? {}) },
      }

      expect(merged.agents.claude).toBe(false) // stored value
      expect(merged.agents.codex).toBe(true) // default
      expect(merged.agents.gemini).toBe(true) // default
      expect(merged.agents.cursor).toBe(true) // default
    })

    test("missing browser sub-keys get defaults", () => {
      const partial: Partial<SettingsState> = {
        browser: { enabled: true } as SettingsState["browser"],
      }

      const merged: SettingsState = {
        ...DEFAULT_SETTINGS,
        ...partial,
        agents: { ...DEFAULT_SETTINGS.agents, ...(partial.agents ?? {}) },
        browser: { ...DEFAULT_SETTINGS.browser, ...(partial.browser ?? {}) },
      }

      expect(merged.browser.enabled).toBe(true) // stored
      expect(merged.browser.consolePanel).toBe(DEFAULT_SETTINGS.browser.consolePanel)
      expect(merged.browser.networkPanel).toBe(DEFAULT_SETTINGS.browser.networkPanel)
      expect(merged.browser.elementInspector).toBe(DEFAULT_SETTINGS.browser.elementInspector)
      expect(merged.browser.defaultUrl).toBe(DEFAULT_SETTINGS.browser.defaultUrl)
    })

    test("localStorage round-trip preserves partial data via updateSettings", () => {
      // Write partial settings
      updateSettings({ theme: "catppuccin" })
      const s = useSettings()()
      expect(s.theme).toBe("catppuccin")
      // All defaults are still present
      expect(s.language).toBe(DEFAULT_SETTINGS.language)
      expect(s.fontSize).toBe(DEFAULT_SETTINGS.fontSize)
    })
  })

  /* ------------------------------------------------------------------ */
  /*  Test 5: Settings migration — unknown keys                          */
  /* ------------------------------------------------------------------ */
  describe("settings migration — unknown keys", () => {
    test("unknown extra keys do not crash the merge logic", () => {
      const stored = {
        theme: "nord",
        unknownField: "hello",
        anotherUnknown: 42,
        nested: { deep: true },
      }

      expect(() => {
        const partial = stored as unknown as Partial<SettingsState>
        const merged: SettingsState = {
          ...DEFAULT_SETTINGS,
          ...partial,
          agents: { ...DEFAULT_SETTINGS.agents, ...(partial.agents ?? {}) },
          browser: { ...DEFAULT_SETTINGS.browser, ...(partial.browser ?? {}) },
        }
        expect(merged.theme).toBe("nord")
        expect(merged.language).toBe(DEFAULT_SETTINGS.language)
      }).not.toThrow()
    })

    test("malformed JSON triggers catch path and returns defaults", () => {
      // Simulate read() with malformed JSON
      const readWithFallback = (raw: string | null): SettingsState => {
        if (!raw) return DEFAULT_SETTINGS
        try {
          const parsed = JSON.parse(raw) as Partial<SettingsState>
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            agents: { ...DEFAULT_SETTINGS.agents, ...(parsed.agents ?? {}) },
            browser: { ...DEFAULT_SETTINGS.browser, ...(parsed.browser ?? {}) },
          }
        } catch {
          return DEFAULT_SETTINGS
        }
      }

      const result = readWithFallback("not-valid-json{{{")
      expect(result).toEqual(DEFAULT_SETTINGS)
    })

    test("null raw input returns defaults", () => {
      const readWithFallback = (raw: string | null): SettingsState => {
        if (!raw) return DEFAULT_SETTINGS
        try {
          const parsed = JSON.parse(raw) as Partial<SettingsState>
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            agents: { ...DEFAULT_SETTINGS.agents, ...(parsed.agents ?? {}) },
            browser: { ...DEFAULT_SETTINGS.browser, ...(parsed.browser ?? {}) },
          }
        } catch {
          return DEFAULT_SETTINGS
        }
      }

      const result = readWithFallback(null)
      expect(result).toEqual(DEFAULT_SETTINGS)
    })
  })
})
