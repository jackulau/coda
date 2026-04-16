import { describe, expect, test } from "bun:test"
import { TerminalVisibility } from "./visibility"

const h = (id: string, workspaceId: string) => ({
  id,
  workspaceId,
  mounted: true,
  display: "none" as const,
  scrollY: 0,
})

describe("TerminalVisibility", () => {
  test("focus shows only target workspace terminals", () => {
    const v = new TerminalVisibility()
    v.add(h("t1", "A"))
    v.add(h("t2", "A"))
    v.add(h("t3", "B"))
    const { shown, hidden } = v.focus("A")
    expect(shown.sort()).toEqual(["t1", "t2"])
    expect(hidden).toEqual([])
    expect(v.activeWorkspace()).toBe("A")
  })

  test("second focus hides outgoing, shows incoming", () => {
    const v = new TerminalVisibility()
    v.add(h("t1", "A"))
    v.add(h("t2", "B"))
    v.focus("A")
    const delta = v.focus("B")
    expect(delta.shown).toEqual(["t2"])
    expect(delta.hidden).toEqual(["t1"])
  })

  test("repeat focus → no-op", () => {
    const v = new TerminalVisibility()
    v.add(h("t1", "A"))
    v.focus("A")
    const delta = v.focus("A")
    expect(delta.shown).toEqual([])
    expect(delta.hidden).toEqual([])
  })

  test("scroll preserved across focus switches", () => {
    const v = new TerminalVisibility()
    v.add(h("t1", "A"))
    v.add(h("t2", "B"))
    v.focus("A")
    v.saveScroll("t1", 420)
    v.focus("B")
    v.focus("A")
    expect(v.getScroll("t1")).toBe(420)
  })

  test("remove increments unmount counter; add is monotonic", () => {
    const v = new TerminalVisibility()
    v.add(h("t1", "A"))
    v.add(h("t2", "A"))
    v.remove("t1")
    expect(v.stats()).toEqual({ mounts: 2, unmounts: 1 })
  })

  test("adding same id twice is a no-op (idempotent)", () => {
    const v = new TerminalVisibility()
    v.add(h("t1", "A"))
    v.add(h("t1", "A"))
    expect(v.stats().mounts).toBe(1)
  })
})
