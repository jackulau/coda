import { describe, expect, test } from "bun:test"
import {
  type A11yAuditResult,
  type A11yViolation,
  canRunAudit,
  excludeOverlayNodes,
  formatReport,
  pruneEmptyViolations,
  sortViolations,
} from "./accessibility"

const v = (overrides: Partial<A11yViolation> = {}): A11yViolation => ({
  id: "color-contrast",
  impact: "serious",
  description: "contrast",
  helpUrl: "https://a",
  nodes: [{ target: ["button.primary"] }],
  ...overrides,
})

describe("sortViolations", () => {
  test("critical → serious → moderate → minor", () => {
    const out = sortViolations([
      v({ id: "a", impact: "minor" }),
      v({ id: "b", impact: "critical" }),
      v({ id: "c", impact: "moderate" }),
    ])
    expect(out.map((x) => x.impact)).toEqual(["critical", "moderate", "minor"])
  })
})

describe("excludeOverlayNodes", () => {
  test("removes overlay selectors from nodes", () => {
    const out = excludeOverlayNodes(
      v({
        nodes: [{ target: ["button"] }, { target: ["__coda_inspector_canvas"] }],
      }),
    )
    expect(out.nodes).toHaveLength(1)
  })
})

describe("pruneEmptyViolations", () => {
  test("drops violations whose nodes were all overlay", () => {
    const out = pruneEmptyViolations([v({ nodes: [{ target: ["__coda_inspector_overlay"] }] })])
    expect(out).toEqual([])
  })
})

describe("formatReport", () => {
  test("renders sorted + pruned report", () => {
    const result: A11yAuditResult = {
      violations: [v({ id: "a", impact: "serious" }), v({ id: "b", impact: "critical" })],
      passes: [{ id: "p1" }],
      incomplete: [],
    }
    const out = formatReport(result)
    expect(out).toContain("Violations: 2")
    const firstLineIdx = out.indexOf("[critical]")
    const secondLineIdx = out.indexOf("[serious]")
    expect(firstLineIdx).toBeLessThan(secondLineIdx)
    expect(firstLineIdx).toBeGreaterThan(-1)
  })
})

describe("canRunAudit", () => {
  test("not loaded → not ok", () => {
    expect(canRunAudit({ loaded: false, failed: false })).toEqual({
      ok: false,
      reason: "axe not loaded",
    })
  })
  test("loaded + not failed → ok", () => {
    expect(canRunAudit({ loaded: true, failed: false })).toEqual({ ok: true })
  })
  test("failed → not ok with reason", () => {
    expect(canRunAudit({ loaded: true, failed: true, reason: "cdn" })).toEqual({
      ok: false,
      reason: "cdn",
    })
  })
})
