import { describe, expect, test } from "bun:test"
import { type Diagnostic, filterDiagnostics } from "@coda/core/problems/panel"

function diag(over: Partial<Diagnostic>): Diagnostic {
  return {
    path: "src/a.ts",
    line: 1,
    column: 1,
    severity: "error",
    message: "boom",
    source: "tsgo",
    ...over,
  }
}

describe("problems context (I2)", () => {
  test("filter by severity=error returns only errors", () => {
    const all = [diag({}), diag({ severity: "warning", message: "w" })]
    const errs = filterDiagnostics(all, { severities: ["error"] })
    expect(errs.length).toBe(1)
  })

  test("filter by source keeps only matching source", () => {
    const all = [diag({ source: "tsgo" }), diag({ source: "eslint" })]
    const out = filterDiagnostics(all, { sources: ["tsgo"] })
    expect(out.length).toBe(1)
    expect(out[0]?.source).toBe("tsgo")
  })

  test("filter by query substring matches against message", () => {
    const all = [diag({ message: "missing semicolon" }), diag({ message: "unused import" })]
    const out = filterDiagnostics(all, { query: "semicolon" })
    expect(out.length).toBe(1)
  })

  test("no filter returns everything", () => {
    const all = [diag({}), diag({ severity: "warning" })]
    expect(filterDiagnostics(all, {}).length).toBe(2)
  })
})
