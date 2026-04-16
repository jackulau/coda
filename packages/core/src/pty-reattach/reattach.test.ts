import { describe, expect, test } from "bun:test"
import {
  HiddenResizeBuffer,
  type PtySessionSnapshot,
  type ScrollbackRing,
  advanceScrollback,
  planReattach,
} from "./reattach"

const s = (o: Partial<PtySessionSnapshot> = {}): PtySessionSnapshot => ({
  id: "p1",
  workspaceId: "w1",
  cwd: "/tmp/ws1",
  shell: "/bin/bash",
  exitedAt: null,
  exitCode: null,
  claudeSessionId: null,
  ...o,
})

describe("planReattach", () => {
  test("live session with existing cwd → reattach", () => {
    const plan = planReattach([s()], { cwdExists: () => true })
    const entry = plan[0]
    expect(entry?.kind).toBe("reattach")
  })

  test("session with exitedAt is history, not reattached", () => {
    const plan = planReattach([s({ exitedAt: 123, exitCode: 0 })], {
      cwdExists: () => true,
    })
    const entry = plan[0]
    expect(entry?.kind).toBe("history")
  })

  test("missing cwd → failed", () => {
    const plan = planReattach([s()], { cwdExists: () => false })
    const entry = plan[0]
    expect(entry?.kind).toBe("failed")
    if (entry?.kind === "failed") expect(entry.reason).toBe("cwd-missing")
  })

  test("multiple sessions planned independently", () => {
    const plan = planReattach(
      [
        s({ id: "p1", cwd: "/ok" }),
        s({ id: "p2", cwd: "/gone" }),
        s({ id: "p3", exitedAt: 5, exitCode: 0 }),
      ],
      { cwdExists: (p) => p !== "/gone" },
    )
    expect(plan.map((e) => e.kind)).toEqual(["reattach", "failed", "history"])
  })
})

describe("HiddenResizeBuffer", () => {
  test("stash overwrites prior for same pane (last write wins)", () => {
    const b = new HiddenResizeBuffer()
    b.stash("pane-a", { cols: 80, rows: 24 })
    b.stash("pane-a", { cols: 120, rows: 40 })
    expect(b.flush("pane-a")).toEqual({ cols: 120, rows: 40 })
  })

  test("flush returns null when nothing pending", () => {
    const b = new HiddenResizeBuffer()
    expect(b.flush("pane-x")).toBeNull()
  })

  test("flush removes entry; size decreases", () => {
    const b = new HiddenResizeBuffer()
    b.stash("a", { cols: 80, rows: 24 })
    b.stash("b", { cols: 80, rows: 24 })
    expect(b.size()).toBe(2)
    b.flush("a")
    expect(b.size()).toBe(1)
  })
})

describe("planReattach edge cases", () => {
  test("non-zero exit code maps to history with crashed reason", () => {
    const plan = planReattach([s({ exitedAt: 1, exitCode: 137 })], {
      cwdExists: () => true,
    })
    const entry = plan[0]
    expect(entry?.kind).toBe("history")
    if (entry?.kind === "history") expect(entry.reason).toBe("crashed")
  })

  test("workspace deleted → reattach aborts with workspace-deleted", () => {
    const plan = planReattach([s()], {
      cwdExists: () => true,
      workspaceExists: () => false,
    })
    const entry = plan[0]
    expect(entry?.kind).toBe("failed")
    if (entry?.kind === "failed") expect(entry.reason).toBe("workspace-deleted")
  })

  test("empty sessions list yields empty plan", () => {
    expect(planReattach([], { cwdExists: () => true })).toEqual([])
  })
})

describe("advanceScrollback", () => {
  test("keeps last N lines when incoming exceeds capacity", () => {
    const ring: ScrollbackRing = { window: ["a", "b"], capacity: 3 }
    const next = advanceScrollback(ring, ["c", "d", "e"])
    expect(next.window).toEqual(["c", "d", "e"])
  })

  test("under capacity keeps everything", () => {
    const ring: ScrollbackRing = { window: ["a"], capacity: 10 }
    const next = advanceScrollback(ring, ["b", "c"])
    expect(next.window).toEqual(["a", "b", "c"])
  })

  test("10MB-sized flood still respects capacity", () => {
    const ring: ScrollbackRing = { window: [], capacity: 100 }
    const flood = Array.from({ length: 10_000 }, (_, i) => `line-${i}`)
    const next = advanceScrollback(ring, flood)
    expect(next.window.length).toBe(100)
    expect(next.window[0]).toBe("line-9900")
  })
})
