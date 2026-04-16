import { describe, expect, test } from "bun:test"
import { type CheckpointRef, buildRef, parseRef, selectForPrune } from "./refs"

describe("buildRef / parseRef", () => {
  test("round-trips", () => {
    const ref = buildRef("wsA", "turn-1")
    expect(ref).toBe("refs/coda/checkpoints/wsA/turn-1")
    expect(parseRef(ref)).toEqual({ workspaceId: "wsA", turnId: "turn-1" })
  })

  test("rejects unsafe chars", () => {
    expect(() => buildRef("ws A", "turn")).toThrow()
    expect(() => buildRef("ws", "turn/slash")).toThrow()
  })

  test("parseRef rejects wrong prefix", () => {
    expect(parseRef("refs/heads/main")).toBeNull()
  })

  test("parseRef rejects malformed refs", () => {
    expect(parseRef("refs/coda/checkpoints/only")).toBeNull()
  })
})

describe("selectForPrune", () => {
  const mk = (ws: string, turn: string, createdAt: number): CheckpointRef => ({
    ref: buildRef(ws, turn),
    workspaceId: ws,
    turnId: turn,
    createdAt,
  })

  test("keeps newest N per workspace", () => {
    const refs = [mk("a", "t1", 100), mk("a", "t2", 200), mk("a", "t3", 300), mk("b", "t1", 150)]
    const pruned = selectForPrune(refs, {
      keepPerWorkspace: 2,
      now: 400,
      maxAgeMs: 10_000,
    })
    expect(pruned.map((r) => r.turnId)).toEqual(["t1"])
  })

  test("drops refs over maxAgeMs regardless of count", () => {
    const refs = [mk("a", "t1", 0), mk("a", "t2", 1_800_000)]
    const pruned = selectForPrune(refs, {
      keepPerWorkspace: 10,
      now: 2_000_000,
      maxAgeMs: 500_000,
    })
    expect(pruned.map((r) => r.turnId)).toEqual(["t1"])
  })

  test("empty list returns empty", () => {
    expect(selectForPrune([], { keepPerWorkspace: 5, now: 0, maxAgeMs: 1000 })).toEqual([])
  })
})
