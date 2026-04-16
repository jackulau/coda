import { describe, expect, test } from "bun:test"
import { DEFAULT_TERMINAL_SETTINGS, mergeSettings } from "@coda/core/terminal-settings/settings"

describe("terminal settings context surface (C5)", () => {
  test("defaults include 14px font + bar cursor + 10k scrollback", () => {
    expect(DEFAULT_TERMINAL_SETTINGS.fontSize).toBe(14)
    expect(DEFAULT_TERMINAL_SETTINGS.cursorStyle).toBe("bar")
    expect(DEFAULT_TERMINAL_SETTINGS.scrollback).toBe(10_000)
  })

  test("mergeSettings preserves untouched fields", () => {
    const next = mergeSettings(DEFAULT_TERMINAL_SETTINGS, { fontSize: 16 })
    expect(next.fontSize).toBe(16)
    expect(next.cursorStyle).toBe("bar")
  })

  test("mergeSettings rejects invalid fontSize", () => {
    expect(() => mergeSettings(DEFAULT_TERMINAL_SETTINGS, { fontSize: 2 })).toThrow()
  })
})
