import { describe, expect, test } from "bun:test"
import { type Diagnostic, filterDiagnostics, groupByPath, totals } from "./panel"

const d = (overrides: Partial<Diagnostic> = {}): Diagnostic => ({
  path: "a.ts",
  line: 1,
  column: 1,
  severity: "error",
  source: "tsc",
  message: "boom",
  ...overrides,
})

describe("groupByPath", () => {
  test("groups diagnostics per file", () => {
    const out = groupByPath([
      d({ path: "a.ts" }),
      d({ path: "a.ts", line: 2 }),
      d({ path: "b.ts", severity: "warning" }),
    ])
    expect(out).toHaveLength(2)
    expect(out[0]?.path).toBe("a.ts")
    expect(out[0]?.counts.error).toBe(2)
    expect(out[1]?.counts.warning).toBe(1)
  })

  test("files sorted errors desc → warnings desc → name asc", () => {
    const out = groupByPath([
      d({ path: "z.ts", severity: "warning" }),
      d({ path: "a.ts", severity: "error" }),
      d({ path: "m.ts", severity: "error" }),
      d({ path: "m.ts", severity: "error" }),
    ])
    expect(out.map((g) => g.path)).toEqual(["m.ts", "a.ts", "z.ts"])
  })

  test("items within a file sorted by severity then line then column", () => {
    const out = groupByPath([
      d({ line: 10, severity: "warning" }),
      d({ line: 5, severity: "error" }),
      d({ line: 5, column: 2, severity: "error" }),
    ])
    const items = out[0]?.items ?? []
    expect(items.map((i) => ({ l: i.line, c: i.column, s: i.severity }))).toEqual([
      { l: 5, c: 1, s: "error" },
      { l: 5, c: 2, s: "error" },
      { l: 10, c: 1, s: "warning" },
    ])
  })
})

describe("filterDiagnostics", () => {
  const list = [
    d({ path: "a.ts", severity: "error", message: "cannot find module", source: "tsc" }),
    d({ path: "a.ts", severity: "warning", message: "unused var", source: "biome" }),
    d({ path: "b.ts", severity: "info", message: "info note", source: "tsc" }),
  ]

  test("severities filter", () => {
    expect(filterDiagnostics(list, { severities: ["error"] })).toHaveLength(1)
  })

  test("sources filter", () => {
    expect(filterDiagnostics(list, { sources: ["biome"] })).toHaveLength(1)
  })

  test("query filter against message and code", () => {
    expect(filterDiagnostics(list, { query: "module" })).toHaveLength(1)
    expect(filterDiagnostics(list, { query: "unused" })).toHaveLength(1)
  })

  test("path filter", () => {
    expect(filterDiagnostics(list, { path: "a.ts" })).toHaveLength(2)
  })
})

describe("totals", () => {
  test("counts by severity", () => {
    expect(
      totals([
        d({ severity: "error" }),
        d({ severity: "error" }),
        d({ severity: "warning" }),
        d({ severity: "info" }),
        d({ severity: "hint" }),
      ]),
    ).toEqual({ error: 2, warning: 1, info: 1, hint: 1 })
  })
})
