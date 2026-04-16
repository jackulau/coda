import { describe, expect, test } from "bun:test"
import { type AxeReport, gate, groupViolations, prioritized } from "./axe"

const report: AxeReport = {
  scannedAt: 0,
  url: "coda://test",
  violations: [
    {
      id: "color-contrast",
      impact: "serious",
      help: "Elements must have sufficient color contrast",
      helpUrl: "https://dequeuniversity.com/rules/axe/color-contrast",
      nodes: [
        { target: ".a", html: "<a>", failureSummary: "low" },
        { target: ".b", html: "<b>", failureSummary: "low" },
      ],
    },
    {
      id: "aria-required-attr",
      impact: "critical",
      help: "Required ARIA attrs",
      helpUrl: "https://dequeuniversity.com/rules/axe/aria-required-attr",
      nodes: [{ target: ".c", html: "<c>", failureSummary: "x" }],
    },
    {
      id: "image-alt",
      impact: "minor",
      help: "Images have alt",
      helpUrl: "https://dequeuniversity.com/rules/axe/image-alt",
      nodes: [],
    },
  ],
}

describe("groupViolations", () => {
  test("counts per impact", () => {
    const g = groupViolations(report)
    expect(g.totals).toEqual({ critical: 1, serious: 1, moderate: 0, minor: 1 })
    expect(g.totalNodes).toBe(3)
  })

  test("sorts within impact by node count desc", () => {
    const big: AxeReport = {
      ...report,
      violations: [
        {
          id: "b",
          impact: "serious",
          help: "h",
          helpUrl: "u",
          nodes: [],
        },
        {
          id: "a",
          impact: "serious",
          help: "h",
          helpUrl: "u",
          nodes: [
            { target: ".x", html: "<x>", failureSummary: "" },
            { target: ".y", html: "<y>", failureSummary: "" },
          ],
        },
      ],
    }
    const g = groupViolations(big)
    expect(g.byImpact.serious.map((v) => v.id)).toEqual(["a", "b"])
  })
})

describe("prioritized", () => {
  test("critical before serious before minor", () => {
    const out = prioritized(report.violations)
    expect(out.map((v) => v.impact)).toEqual(["critical", "serious", "minor"])
  })
})

describe("gate", () => {
  test("passes when under budgets", () => {
    expect(gate(report, { maxCritical: 2, maxSerious: 2 }).passed).toBe(true)
  })

  test("fails on critical over budget", () => {
    const r = gate(report, { maxCritical: 0, maxSerious: 5 })
    expect(r.passed).toBe(false)
    expect(r.reason).toContain("critical")
  })

  test("fails on serious over budget", () => {
    const r = gate(report, { maxCritical: 5, maxSerious: 0 })
    expect(r.passed).toBe(false)
    expect(r.reason).toContain("serious")
  })
})
