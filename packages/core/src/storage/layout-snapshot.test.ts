import { describe, expect, test } from "bun:test"
import {
  LAYOUT_SNAPSHOT_VERSION,
  type LayoutSnapshot,
  deserialize,
  emptySnapshot,
  migrate,
  serialize,
} from "./layout-snapshot"

describe("LayoutSnapshot", () => {
  test("emptySnapshot is at current version", () => {
    expect(emptySnapshot().version).toBe(LAYOUT_SNAPSHOT_VERSION)
  })

  test("serialize → deserialize round-trip is lossless", () => {
    const snap: LayoutSnapshot = {
      version: LAYOUT_SNAPSHOT_VERSION,
      focusedWorkspaceId: "w1",
      expandedProjects: { p1: true, p2: false },
      panels: { sidebarWidth: 320, rightRailWidth: 400, portsPanelHeight: 200 },
      openPrTabs: [{ number: 7, owner: "o", repo: "r" }],
      openBrowserTabs: [{ id: "tab1", workspaceId: "w1", url: "http://localhost:3000" }],
      terminalTabs: [{ sessionId: "s1", workspaceId: "w1", orderIndex: 0 }],
      portsPanel: { expandedExternal: true, dismissed: [3000] },
      capturedAt: 1700000000,
    }
    const json = serialize(snap)
    const out = deserialize(json)
    expect(out).toEqual(snap)
  })

  test("v1 migrates forward to v2 with safe defaults", () => {
    const v1 = {
      version: 1,
      focusedWorkspaceId: "w1",
      expandedProjects: { p1: true },
      sidebarWidth: 999,
      rightRailWidth: 100,
      portsPanelHeight: 50,
    }
    const out = migrate(v1, { now: () => 42 })
    expect(out.version).toBe(LAYOUT_SNAPSHOT_VERSION)
    expect(out.focusedWorkspaceId).toBe("w1")
    expect(out.panels.sidebarWidth).toBe(400)
    expect(out.panels.rightRailWidth).toBe(300)
    expect(out.panels.portsPanelHeight).toBe(120)
    expect(out.capturedAt).toBe(42)
    expect(out.openPrTabs).toEqual([])
  })

  test("unknown version → empty snapshot", () => {
    const out = migrate({ version: 99 }, { now: () => 100 })
    expect(out).toEqual(emptySnapshot(100))
  })

  test("malformed JSON → empty snapshot, never throws", () => {
    const out = deserialize("{not json", { now: () => 7 })
    expect(out).toEqual(emptySnapshot(7))
  })

  test("rejects out-of-range panel widths in v2 schema", () => {
    expect(() =>
      serialize({
        ...emptySnapshot(),
        panels: { sidebarWidth: 100, rightRailWidth: 380, portsPanelHeight: 180 },
      }),
    ).toThrow()
  })

  test("rejects non-listening port number in dismissed list", () => {
    expect(() =>
      serialize({
        ...emptySnapshot(),
        portsPanel: { expandedExternal: false, dismissed: [70000] },
      }),
    ).toThrow()
  })
})
