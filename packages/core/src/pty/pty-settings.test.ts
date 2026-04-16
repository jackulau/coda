import { describe, expect, test } from "bun:test"
import {
  DEFAULT_TERMINAL_SETTINGS,
  TerminalSettings,
  mergeSettings,
} from "../terminal-settings/settings"

describe("Terminal settings (pty-settings.test.ts → settings module)", () => {
  test("defaults include font size 14, bar cursor, 10k scrollback", () => {
    expect(DEFAULT_TERMINAL_SETTINGS.fontSize).toBe(14)
    expect(DEFAULT_TERMINAL_SETTINGS.cursorStyle).toBe("bar")
    expect(DEFAULT_TERMINAL_SETTINGS.scrollback).toBe(10_000)
  })

  test("mergeSettings preserves untouched keys", () => {
    const next = mergeSettings(DEFAULT_TERMINAL_SETTINGS, { fontSize: 18 })
    expect(next.fontSize).toBe(18)
    expect(next.cursorStyle).toBe("bar")
  })

  test("fontSize out of bounds rejected", () => {
    expect(() => TerminalSettings.parse({ fontSize: 4 })).toThrow()
    expect(() => TerminalSettings.parse({ fontSize: 99 })).toThrow()
  })

  test("scrollback out of bounds rejected", () => {
    expect(() => TerminalSettings.parse({ scrollback: 10 })).toThrow()
    expect(() => TerminalSettings.parse({ scrollback: 10_000_000 })).toThrow()
  })

  test("cursorStyle accepts bar/block/underline", () => {
    for (const style of ["bar", "block", "underline"] as const) {
      expect(TerminalSettings.parse({ cursorStyle: style }).cursorStyle).toBe(style)
    }
  })

  test("startupCommand max length enforced", () => {
    const long = "x".repeat(5000)
    expect(() => TerminalSettings.parse({ startupCommand: long })).toThrow()
  })
})
