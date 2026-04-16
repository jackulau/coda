import { describe, expect, test } from "bun:test"
import {
  DEFAULT_TERMINAL_SETTINGS,
  TerminalSettings,
  applyScrollbackChange,
  defaultRightClickPaste,
  effectiveCursorBlink,
  mergeSettings,
  platformDefaultShell,
  resolveStartupCommand,
  shouldWarnLargeScrollback,
} from "./settings"

describe("TerminalSettings defaults", () => {
  test("match mock (14 px Bar, no blink, 10k scrollback, empty startup)", () => {
    expect(DEFAULT_TERMINAL_SETTINGS).toMatchObject({
      fontSize: 14,
      cursorStyle: "bar",
      cursorBlink: false,
      scrollback: 10_000,
      startupCommand: "",
    })
  })
})

describe("TerminalSettings schema", () => {
  test("rejects fontSize < 10 and > 24", () => {
    expect(() => TerminalSettings.parse({ fontSize: 9 })).toThrow()
    expect(() => TerminalSettings.parse({ fontSize: 25 })).toThrow()
  })

  test("rejects invalid cursorStyle", () => {
    expect(() => TerminalSettings.parse({ cursorStyle: "laser" as never })).toThrow()
  })

  test("scrollback clamped to bounds", () => {
    expect(() => TerminalSettings.parse({ scrollback: 50 })).toThrow()
    expect(() => TerminalSettings.parse({ scrollback: 500_000 })).toThrow()
  })
})

describe("mergeSettings", () => {
  test("partial override preserves untouched fields", () => {
    const out = mergeSettings(DEFAULT_TERMINAL_SETTINGS, { fontSize: 18 })
    expect(out.fontSize).toBe(18)
    expect(out.cursorStyle).toBe("bar")
  })
})

describe("applyScrollbackChange", () => {
  test("reducing scrollback trims overflow lines", () => {
    const r = applyScrollbackChange(0, 15_000, 10_000)
    expect(r.trimmed).toBe(5000)
    expect(r.finalLines).toBe(10_000)
  })

  test("increasing scrollback keeps all buffered", () => {
    const r = applyScrollbackChange(0, 5000, 20_000)
    expect(r.trimmed).toBe(0)
    expect(r.finalLines).toBe(5000)
  })
})

describe("shouldWarnLargeScrollback", () => {
  test("warns above 50k", () => {
    expect(shouldWarnLargeScrollback(50_001)).toBe(true)
    expect(shouldWarnLargeScrollback(50_000)).toBe(false)
  })
})

describe("resolveStartupCommand", () => {
  test("empty stays empty", () => {
    expect(resolveStartupCommand("", false).command).toBe("")
  })

  test("appends newline for execution", () => {
    expect(resolveStartupCommand("claude --effort max", false).command).toBe(
      "claude --effort max\n",
    )
  })

  test("preserves existing trailing newline without doubling", () => {
    expect(resolveStartupCommand("claude\n", false).command).toBe("claude\n")
  })
})

describe("effectiveCursorBlink", () => {
  test("prefers-reduced-motion forces off", () => {
    expect(effectiveCursorBlink(true, true)).toBe(false)
  })

  test("otherwise honors setting", () => {
    expect(effectiveCursorBlink(true, false)).toBe(true)
    expect(effectiveCursorBlink(false, false)).toBe(false)
  })
})

describe("platformDefaultShell", () => {
  test("darwin → zsh, win32 → pwsh.exe, linux → bash", () => {
    expect(platformDefaultShell("darwin")).toBe("/bin/zsh")
    expect(platformDefaultShell("win32")).toBe("pwsh.exe")
    expect(platformDefaultShell("linux")).toBe("/bin/bash")
  })
})

describe("defaultRightClickPaste", () => {
  test("on for Windows, off elsewhere", () => {
    expect(defaultRightClickPaste("win32")).toBe(true)
    expect(defaultRightClickPaste("darwin")).toBe(false)
    expect(defaultRightClickPaste("linux")).toBe(false)
  })
})
