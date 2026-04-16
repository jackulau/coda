import { describe, expect, test } from "bun:test"
import { Shortcuts } from "@coda/core"

describe("global keyboard shortcuts (U3)", () => {
  test("chord string normalization is platform-aware", () => {
    const mac = Shortcuts.normalizeChord("⌘P", "mac")
    const win = Shortcuts.normalizeChord("Ctrl+P", "win")
    expect(mac.length).toBeGreaterThan(0)
    expect(win.length).toBeGreaterThan(0)
  })

  test("defining the same id twice throws", () => {
    const reg = new Shortcuts.ShortcutRegistry("mac")
    reg.define({ id: "a.one", defaultChord: "Cmd+K", description: "one", scope: "global" })
    expect(() =>
      reg.define({ id: "a.one", defaultChord: "Cmd+J", description: "dup", scope: "global" }),
    ).toThrow(/already defined/)
  })

  test("override replaces the effective chord for a shortcut id", () => {
    const reg = new Shortcuts.ShortcutRegistry("mac")
    reg.define({ id: "a.one", defaultChord: "Cmd+K", description: "one", scope: "global" })
    reg.override("a.one", "Cmd+J")
    const binding = reg.list().find((b) => b.id === "a.one")
    expect(binding?.effectiveChord).toBe(Shortcuts.normalizeChord("Cmd+J", "mac"))
    expect(binding?.source).toBe("user-override")
  })

  test("override of unknown id throws", () => {
    const reg = new Shortcuts.ShortcutRegistry("mac")
    expect(() => reg.override("nope", "Cmd+K")).toThrow(/unknown shortcut id/)
  })

  test("override with null restores default", () => {
    const reg = new Shortcuts.ShortcutRegistry("mac")
    reg.define({ id: "a.one", defaultChord: "Cmd+K", description: "one", scope: "global" })
    reg.override("a.one", "Cmd+J")
    reg.override("a.one", null)
    const binding = reg.list().find((b) => b.id === "a.one")
    expect(binding?.source).toBe("default")
  })
})
