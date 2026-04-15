import { describe, expect, test } from "bun:test"
import { ShortcutRegistry, normalizeChord } from "./registry"

describe("normalizeChord", () => {
  test("Mod resolves to Cmd on mac, Ctrl elsewhere", () => {
    expect(normalizeChord("Mod+P", "mac")).toBe("Cmd+P")
    expect(normalizeChord("Mod+P", "win")).toBe("Ctrl+P")
    expect(normalizeChord("Mod+P", "linux")).toBe("Ctrl+P")
  })

  test("aliases (cmd/option/control) normalize", () => {
    expect(normalizeChord("cmd+shift+p", "mac")).toBe("Cmd+Shift+P")
    expect(normalizeChord("control+alt+t", "linux")).toBe("Ctrl+Alt+T")
    expect(normalizeChord("option+enter", "mac")).toBe("Alt+Enter")
  })

  test("modifier order canonicalized regardless of input order", () => {
    expect(normalizeChord("Shift+Cmd+K", "mac")).toBe("Cmd+Shift+K")
    expect(normalizeChord("Alt+Ctrl+J", "win")).toBe("Ctrl+Alt+J")
  })

  test("dedups duplicate modifiers", () => {
    expect(normalizeChord("Cmd+Cmd+K", "mac")).toBe("Cmd+K")
  })

  test("missing key throws", () => {
    expect(() => normalizeChord("Cmd+Shift", "mac")).toThrow()
  })
})

describe("ShortcutRegistry", () => {
  test("define + list returns binding with default chord", () => {
    const r = new ShortcutRegistry("mac")
    r.define({
      id: "palette.open",
      defaultChord: "Mod+P",
      description: "Open command palette",
      scope: "global",
    })
    const list = r.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.effectiveChord).toBe("Cmd+P")
    expect(list[0]?.source).toBe("default")
  })

  test("override changes effective chord and marks user-override", () => {
    const r = new ShortcutRegistry("linux")
    r.define({
      id: "palette.open",
      defaultChord: "Mod+P",
      description: "x",
      scope: "global",
    })
    r.override("palette.open", "Ctrl+Shift+P")
    const b = r.list()[0]
    expect(b?.effectiveChord).toBe("Ctrl+Shift+P")
    expect(b?.source).toBe("user-override")
  })

  test("override(null) reverts to default", () => {
    const r = new ShortcutRegistry("mac")
    r.define({ id: "x", defaultChord: "Mod+K", description: "x", scope: "global" })
    r.override("x", "Mod+J")
    r.override("x", null)
    expect(r.list()[0]?.effectiveChord).toBe("Cmd+K")
    expect(r.list()[0]?.source).toBe("default")
  })

  test("conflicts() reports duplicate chord within same scope", () => {
    const r = new ShortcutRegistry("mac")
    r.define({ id: "a", defaultChord: "Mod+K", description: "x", scope: "editor" })
    r.define({ id: "b", defaultChord: "Mod+K", description: "y", scope: "editor" })
    const c = r.conflicts()
    expect(c).toHaveLength(1)
    expect(c[0]?.ids).toEqual(["a", "b"])
  })

  test("conflicts ignores cross-scope same chord", () => {
    const r = new ShortcutRegistry("mac")
    r.define({ id: "a", defaultChord: "Mod+K", description: "x", scope: "editor" })
    r.define({ id: "b", defaultChord: "Mod+K", description: "y", scope: "terminal" })
    expect(r.conflicts()).toEqual([])
  })

  test("resolve finds id from chord+scope", () => {
    const r = new ShortcutRegistry("win")
    r.define({ id: "palette", defaultChord: "Mod+P", description: "x", scope: "global" })
    expect(r.resolve("Ctrl+P", "editor")).toBe("palette")
    expect(r.resolve("Ctrl+J", "editor")).toBe(null)
  })

  test("define with duplicate id throws", () => {
    const r = new ShortcutRegistry("mac")
    r.define({ id: "x", defaultChord: "Mod+K", description: "x", scope: "global" })
    expect(() =>
      r.define({ id: "x", defaultChord: "Mod+J", description: "y", scope: "global" }),
    ).toThrow(/already defined/)
  })

  test("override on unknown id throws", () => {
    const r = new ShortcutRegistry("mac")
    expect(() => r.override("nope", "Mod+K")).toThrow(/unknown/)
  })
})
