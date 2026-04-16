import { describe, expect, test } from "bun:test"
import { type CheckpointEvent, filterBySearch, groupByDay, restorePlan } from "./timeline"

const day = (y: number, m: number, d: number, h = 12): number => Date.UTC(y, m - 1, d, h, 0, 0)

const e = (overrides: Partial<CheckpointEvent>): CheckpointEvent => ({
  id: overrides.id ?? "c",
  workspaceId: "w",
  createdAt: overrides.createdAt ?? 0,
  label: overrides.label ?? "x",
  refSha: overrides.refSha ?? "deadbeef",
  author: overrides.author ?? "agent",
  parentId: overrides.parentId,
})

describe("groupByDay", () => {
  test("groups into calendar days sorted newest first", () => {
    const groups = groupByDay(
      [
        e({ id: "1", createdAt: day(2026, 4, 15, 10) }),
        e({ id: "2", createdAt: day(2026, 4, 16, 10) }),
        e({ id: "3", createdAt: day(2026, 4, 16, 14) }),
      ],
      day(2026, 4, 16, 23),
    )
    expect(groups[0]?.label).toBe("Today")
    expect(groups[0]?.items.map((x) => x.id)).toEqual(["3", "2"])
    expect(groups[1]?.label).toBe("Yesterday")
  })

  test("older days get ISO label", () => {
    const groups = groupByDay([e({ id: "1", createdAt: day(2025, 1, 5) })], day(2026, 4, 16))
    expect(groups[0]?.label).toBe("2025-01-05")
  })
})

describe("filterBySearch", () => {
  test("matches label + sha substring", () => {
    const events = [
      e({ id: "a", label: "Fix login", refSha: "ab123" }),
      e({ id: "b", label: "Refactor", refSha: "cd456" }),
    ]
    expect(filterBySearch(events, "fix").map((x) => x.id)).toEqual(["a"])
    expect(filterBySearch(events, "CD").map((x) => x.id)).toEqual(["b"])
  })

  test("empty query returns all", () => {
    expect(filterBySearch([e({ id: "a" })], "").length).toBe(1)
  })
})

describe("restorePlan", () => {
  test("known id returns targetSha", () => {
    expect(restorePlan([e({ id: "c1", refSha: "feedbeef" })], "c1")).toEqual({
      ok: true,
      targetSha: "feedbeef",
    })
  })
  test("unknown id → not-found", () => {
    expect(restorePlan([], "missing").reason).toBe("not-found")
  })
})
