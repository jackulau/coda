import { describe, expect, test, vi } from "vitest"
import { createShortcutBridge } from "./shortcut-bridge"

function keydown(init: KeyboardEventInit & { key: string }): KeyboardEvent {
  return new KeyboardEvent("keydown", init)
}

describe("ShortcutBridge (T9)", () => {
  test("cmdP_runs_palette_open_command_on_mac", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const handler = vi.fn()
    const e = keydown({ key: "p", metaKey: true, cancelable: true })
    const spy = vi.spyOn(e, "preventDefault")
    const ran = bridge.dispatch(e, { "coda.palette.open": handler })
    expect(ran).toBe(true)
    expect(handler).toHaveBeenCalled()
    expect(spy).toHaveBeenCalled()
  })

  test("ctrlP_runs_palette_open_command_on_linux", () => {
    const bridge = createShortcutBridge({ platform: "linux" })
    const handler = vi.fn()
    const e = keydown({ key: "p", ctrlKey: true, cancelable: true })
    const ran = bridge.dispatch(e, { "coda.palette.open": handler })
    expect(ran).toBe(true)
    expect(handler).toHaveBeenCalled()
  })

  test("unknown_chord_does_nothing_and_does_not_preventDefault", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const handler = vi.fn()
    const e = keydown({ key: "z", altKey: true, cancelable: true })
    const spy = vi.spyOn(e, "preventDefault")
    const ran = bridge.dispatch(e, { "coda.palette.open": handler })
    expect(ran).toBe(false)
    expect(handler).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
  })

  test("save_shortcut_invokes_save_handler", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const save = vi.fn()
    const e = keydown({ key: "s", metaKey: true, cancelable: true })
    expect(bridge.dispatch(e, { "coda.tab.save": save })).toBe(true)
    expect(save).toHaveBeenCalled()
  })

  test("known_chord_without_registered_handler_returns_false", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const e = keydown({ key: "p", metaKey: true, cancelable: true })
    expect(bridge.dispatch(e, {})).toBe(false)
  })

  test("bare_modifier_press_does_not_resolve", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const e = keydown({ key: "Meta", metaKey: true, cancelable: true })
    expect(bridge.dispatch(e, { "coda.palette.open": vi.fn() })).toBe(false)
  })

  test("install_installs_and_cleans_up_window_listener", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const handler = vi.fn()
    const cleanup = bridge.install(() => ({ "coda.palette.open": handler }))
    const e = new KeyboardEvent("keydown", { key: "p", metaKey: true, cancelable: true })
    window.dispatchEvent(e)
    expect(handler).toHaveBeenCalledTimes(1)
    cleanup()
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "p", metaKey: true }))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test("list_includes_built_in_shortcuts", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const ids = bridge.list().map((b) => b.id)
    expect(ids).toContain("coda.palette.open")
    expect(ids).toContain("coda.tab.save")
    expect(ids).toContain("coda.tab.close")
    expect(ids).toContain("coda.sidebar.toggle")
  })
})
