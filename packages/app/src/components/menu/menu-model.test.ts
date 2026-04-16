import { describe, expect, test } from "bun:test"
import { defaultMenu, resolveMenu } from "@coda/core/menu/model"

describe("menu model (U1)", () => {
  test("defaultMenu returns the top-level menu bar shape", () => {
    const items = defaultMenu()
    expect(items.length).toBeGreaterThan(0)
    const labels = items.map((i) => i.label)
    expect(labels).toContain("Coda")
    expect(labels.length).toBeGreaterThan(3)
  })

  test("resolveMenu maps through the ctx platform", () => {
    const resolved = resolveMenu(defaultMenu(), {
      platform: "mac",
      hasFocusedWorkspace: true,
      hasOpenPr: false,
      hasSelection: false,
      sidebarVisible: true,
      rightRailVisible: true,
    })
    expect(resolved.length).toBeGreaterThan(0)
  })
})
