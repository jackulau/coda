import { describe, expect, test } from "bun:test"
import { comparePrs } from "./compare"
import type { PrFile, PrView } from "./index"

const file = (overrides: Partial<PrFile> = {}): PrFile => ({
  path: "a.ts",
  status: "modified",
  additions: 1,
  deletions: 0,
  patch: "p",
  ...overrides,
})

const pr = (files: PrFile[], number = 1): PrView => ({
  number,
  state: "open",
  title: `#${number}`,
  headSha: "abcdef0",
  baseSha: "0000001",
  author: "u",
  files,
})

describe("comparePrs", () => {
  test("files unique to A marked added-in-a", () => {
    const a = pr([file({ path: "x.ts" })])
    const b = pr([])
    const out = comparePrs(a, b)
    expect(out.files[0]).toMatchObject({ path: "x.ts", kind: "added-in-a" })
    expect(out.totals.added).toBe(1)
  })

  test("files unique to B marked added-in-b", () => {
    const a = pr([])
    const b = pr([file({ path: "y.ts" })])
    const out = comparePrs(a, b)
    expect(out.files[0]?.kind).toBe("added-in-b")
  })

  test("identical patch → same", () => {
    const a = pr([file({ path: "x.ts", additions: 5, deletions: 2, patch: "P" })])
    const b = pr([file({ path: "x.ts", additions: 5, deletions: 2, patch: "P" })])
    const out = comparePrs(a, b)
    expect(out.files[0]?.kind).toBe("same")
    expect(out.totals.modified).toBe(0)
  })

  test("different patch → modified-in-both", () => {
    const a = pr([file({ path: "x.ts", additions: 5, patch: "p1" })])
    const b = pr([file({ path: "x.ts", additions: 7, patch: "p2" })])
    const out = comparePrs(a, b)
    expect(out.files[0]).toMatchObject({
      kind: "modified-in-both",
      additionsA: 5,
      additionsB: 7,
    })
    expect(out.totals.modified).toBe(1)
  })

  test("files sorted alphabetically", () => {
    const a = pr([file({ path: "z.ts" }), file({ path: "a.ts" })])
    const b = pr([file({ path: "m.ts" })])
    const out = comparePrs(a, b)
    expect(out.files.map((f) => f.path)).toEqual(["a.ts", "m.ts", "z.ts"])
  })
})
