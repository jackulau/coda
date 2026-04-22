import { describe, expect, test } from "bun:test"
import {
  DARK_VARS,
  LIGHT_VARS,
  buildFontStack,
  centerOrder,
  resolveColorScheme,
  shouldReduceMotion,
  sidebarOrder,
} from "./apply-settings"

describe("resolveColorScheme", () => {
  test('"system" with systemPrefersDark=true returns "dark"', () => {
    expect(resolveColorScheme("system", true)).toBe("dark")
  })

  test('"system" with systemPrefersDark=false returns "light"', () => {
    expect(resolveColorScheme("system", false)).toBe("light")
  })

  test('"dark" always returns "dark"', () => {
    expect(resolveColorScheme("dark", false)).toBe("dark")
    expect(resolveColorScheme("dark", true)).toBe("dark")
  })

  test('"light" always returns "light"', () => {
    expect(resolveColorScheme("light", false)).toBe("light")
    expect(resolveColorScheme("light", true)).toBe("light")
  })
})

describe("buildFontStack", () => {
  test('"Fira Code" produces correct stack', () => {
    expect(buildFontStack("Fira Code")).toBe('"Fira Code", "SF Mono", Menlo, Consolas, monospace')
  })

  test("fallback fonts are always appended", () => {
    const stack = buildFontStack("JetBrains Mono")
    expect(stack).toContain("Menlo")
    expect(stack).toContain("Consolas")
    expect(stack).toContain("monospace")
  })
})

describe("LIGHT_VARS", () => {
  test("has all keys present in DARK_VARS", () => {
    const darkKeys = Object.keys(DARK_VARS).sort()
    const lightKeys = Object.keys(LIGHT_VARS).sort()
    expect(lightKeys).toEqual(darkKeys)
  })

  test("every color value is a valid CSS color string", () => {
    const hexOrRgba = /^(#[0-9a-f]{3,8}|rgba?\(.+\))$/i
    const timingValue = /^\d+ms\s/
    for (const [key, value] of Object.entries(LIGHT_VARS)) {
      // Motion variables are timing values, not colors
      if (key.startsWith("--motion-")) {
        expect(timingValue.test(value)).toBe(true)
        continue
      }
      // Shadow values contain rgba() but don't match simple patterns
      if (key.startsWith("--shadow-")) {
        expect(value).toContain("rgba(")
        continue
      }
      expect(hexOrRgba.test(value)).toBe(true)
    }
  })
})

describe("DARK_VARS", () => {
  test("matches the existing :root dark theme values (full regression guard)", () => {
    // Backgrounds
    expect(DARK_VARS["--bg-0"]).toBe("#0a0a0b")
    expect(DARK_VARS["--bg-1"]).toBe("#121214")
    expect(DARK_VARS["--bg-2"]).toBe("#1a1a1d")
    expect(DARK_VARS["--bg-3"]).toBe("#24242a")
    expect(DARK_VARS["--bg-input"]).toBe("#0d0d0f")
    expect(DARK_VARS["--bg-overlay"]).toBe("rgba(10, 10, 11, 0.85)")
    // Borders
    expect(DARK_VARS["--border-subtle"]).toBe("#1f1f23")
    expect(DARK_VARS["--border-default"]).toBe("#2a2a30")
    expect(DARK_VARS["--border-emphasis"]).toBe("#3a3a44")
    // Text
    expect(DARK_VARS["--text-primary"]).toBe("#e8e8ec")
    expect(DARK_VARS["--text-secondary"]).toBe("#9a9aa6")
    expect(DARK_VARS["--text-tertiary"]).toBe("#64646e")
    // Accent
    expect(DARK_VARS["--accent-500"]).toBe("#ff6b1a")
    expect(DARK_VARS["--accent-glow"]).toBe("rgba(255, 107, 26, 0.15)")
    // Diff
    expect(DARK_VARS["--diff-add"]).toBe("#3fb950")
    expect(DARK_VARS["--diff-remove"]).toBe("#f85149")
    // Status
    expect(DARK_VARS["--status-idle"]).toBe("#64646e")
    expect(DARK_VARS["--status-run"]).toBe("#ff6b1a")
    expect(DARK_VARS["--status-await"]).toBe("#e3b341")
    expect(DARK_VARS["--status-error"]).toBe("#f85149")
    // Motion
    expect(DARK_VARS["--motion-fast"]).toBe("120ms cubic-bezier(0.2, 0, 0.2, 1)")
    expect(DARK_VARS["--motion-base"]).toBe("180ms cubic-bezier(0.2, 0, 0.2, 1)")
    expect(DARK_VARS["--motion-slow"]).toBe("280ms cubic-bezier(0.2, 0, 0.2, 1)")
    // Shadow
    expect(DARK_VARS["--shadow-panel"]).toBe(
      "0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.25)",
    )
  })
})

describe("sidebarOrder", () => {
  test('"left" returns 0', () => {
    expect(sidebarOrder("left")).toBe(0)
  })

  test('"right" returns 2', () => {
    expect(sidebarOrder("right")).toBe(2)
  })
})

describe("centerOrder", () => {
  test('"left" returns 1', () => {
    expect(centerOrder("left")).toBe(1)
  })

  test('"right" returns 0', () => {
    expect(centerOrder("right")).toBe(0)
  })
})

describe("shouldReduceMotion", () => {
  test("setting on, OS off => true", () => {
    expect(shouldReduceMotion(true, false)).toBe(true)
  })

  test("setting off, OS on => true", () => {
    expect(shouldReduceMotion(false, true)).toBe(true)
  })

  test("both off => false", () => {
    expect(shouldReduceMotion(false, false)).toBe(false)
  })

  test("both on => true", () => {
    expect(shouldReduceMotion(true, true)).toBe(true)
  })
})
