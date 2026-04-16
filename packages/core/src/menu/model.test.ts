import { describe, expect, test } from "bun:test"
import { type MenuContext, defaultMenu, resolveMenu } from "./model"

const baseCtx = (overrides: Partial<MenuContext> = {}): MenuContext => ({
  hasFocusedWorkspace: true,
  hasOpenPr: false,
  hasSelection: false,
  sidebarVisible: true,
  rightRailVisible: true,
  platform: "mac",
  ...overrides,
})

describe("resolveMenu", () => {
  test("top-level labels present", () => {
    const out = resolveMenu(defaultMenu(), baseCtx())
    expect(out.map((m) => m.label)).toEqual(["Coda", "File", "Edit", "View"])
  })

  test("Close Workspace disabled when no focused workspace", () => {
    const ctx = baseCtx({ hasFocusedWorkspace: false })
    const file = resolveMenu(defaultMenu(), ctx).find((m) => m.id === "file")
    const close = file?.submenu?.find((s) => s.id === "close-ws")
    expect(close?.disabled).toBe(true)
  })

  test("Cut/Copy disabled without selection", () => {
    const ctx = baseCtx({ hasSelection: false })
    const edit = resolveMenu(defaultMenu(), ctx).find((m) => m.id === "edit")
    expect(edit?.submenu?.find((s) => s.id === "cut")?.disabled).toBe(true)
    expect(edit?.submenu?.find((s) => s.id === "copy")?.disabled).toBe(true)
    expect(edit?.submenu?.find((s) => s.id === "paste")?.disabled).toBe(false)
  })

  test("Cut/Copy enabled with selection", () => {
    const ctx = baseCtx({ hasSelection: true })
    const edit = resolveMenu(defaultMenu(), ctx).find((m) => m.id === "edit")
    expect(edit?.submenu?.find((s) => s.id === "cut")?.disabled).toBe(false)
  })

  test("separators preserved", () => {
    const coda = resolveMenu(defaultMenu(), baseCtx()).find((m) => m.id === "coda")
    const seps = coda?.submenu?.filter((s) => s.separator) ?? []
    expect(seps.length).toBeGreaterThan(0)
  })

  test("command palette shortcut is Mod+P", () => {
    const view = resolveMenu(defaultMenu(), baseCtx()).find((m) => m.id === "view")
    const palette = view?.submenu?.find((s) => s.id === "cmd-palette")
    expect(palette?.shortcut).toBe("Mod+P")
  })
})
