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

  test("skips_when_event_target_is_input", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const save = vi.fn()
    // Simulate a keydown whose target is an <input> — e.g. the user
    // typing in a sidebar rename field.
    const input = document.createElement("input")
    document.body.appendChild(input)
    const e = new KeyboardEvent("keydown", { key: "s", metaKey: true, cancelable: true })
    Object.defineProperty(e, "target", { value: input, configurable: true })
    const spy = vi.spyOn(e, "preventDefault")
    const ran = bridge.dispatch(e, { "coda.tab.save": save })
    expect(ran).toBe(false)
    expect(save).not.toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
    input.remove()
  })

  test("skips_when_event_target_is_textarea", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const save = vi.fn()
    const ta = document.createElement("textarea")
    document.body.appendChild(ta)
    const e = new KeyboardEvent("keydown", { key: "s", metaKey: true, cancelable: true })
    Object.defineProperty(e, "target", { value: ta, configurable: true })
    expect(bridge.dispatch(e, { "coda.tab.save": save })).toBe(false)
    expect(save).not.toHaveBeenCalled()
    ta.remove()
  })

  test("skips_when_event_target_is_contenteditable", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const save = vi.fn()
    const div = document.createElement("div")
    div.contentEditable = "true"
    document.body.appendChild(div)
    const e = new KeyboardEvent("keydown", { key: "s", metaKey: true, cancelable: true })
    Object.defineProperty(e, "target", { value: div, configurable: true })
    expect(bridge.dispatch(e, { "coda.tab.save": save })).toBe(false)
    expect(save).not.toHaveBeenCalled()
    div.remove()
  })

  test("install_twice_attaches_only_one_listener", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const handler = vi.fn()
    const cleanup1 = bridge.install(() => ({ "coda.palette.open": handler }))
    const cleanup2 = bridge.install(() => ({ "coda.palette.open": handler }))
    // Second install returns the same cleanup (idempotent).
    expect(cleanup1).toBe(cleanup2)
    // A keydown should fire the handler exactly once, not twice.
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "p", metaKey: true, cancelable: true }),
    )
    expect(handler).toHaveBeenCalledTimes(1)
    cleanup1()
  })

  test("reinstall_after_cleanup_works", () => {
    const bridge = createShortcutBridge({ platform: "mac" })
    const handler = vi.fn()
    const cleanup1 = bridge.install(() => ({ "coda.palette.open": handler }))
    cleanup1()
    // Second install after teardown attaches a fresh listener.
    const cleanup2 = bridge.install(() => ({ "coda.palette.open": handler }))
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "p", metaKey: true, cancelable: true }),
    )
    expect(handler).toHaveBeenCalledTimes(1)
    cleanup2()
  })
})
