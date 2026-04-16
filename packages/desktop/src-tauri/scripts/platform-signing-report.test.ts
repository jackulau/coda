// platform-signing-report.test.ts — covers every 2^3 combination of signing
// status across macOS/Windows/Linux plus the partial-notarization edge case.
// The report is embedded in the GitHub release body so the text has to be
// both human-readable AND stable for changelog tooling.

import { describe, expect, test } from "bun:test"
import { generateReport, type PlatformStatus, type SigningInput } from "./platform-signing-report"

const SIGNED: PlatformStatus = "signed"
const UNSIGNED: PlatformStatus = "unsigned"
const SKIPPED: PlatformStatus = "skipped"

function inp(m: PlatformStatus, w: PlatformStatus, l: PlatformStatus): SigningInput {
  return { macos: m, windows: w, linux: l }
}

describe("generateReport — happy path: all signed", () => {
  test("emits concise all-signed summary", () => {
    const r = generateReport(inp(SIGNED, SIGNED, SIGNED))
    expect(r).toContain("All builds signed and verified")
    expect(r).not.toContain("What this means for users")
  })

  test("all-signed report has no Gatekeeper / SmartScreen warnings", () => {
    const r = generateReport(inp(SIGNED, SIGNED, SIGNED))
    expect(r).not.toMatch(/Gatekeeper/i)
    expect(r).not.toMatch(/SmartScreen/i)
  })
})

describe("generateReport — mixed states get a 'What this means for users' section", () => {
  test("macOS unsigned → Gatekeeper warning text", () => {
    const r = generateReport(inp(UNSIGNED, SIGNED, SIGNED))
    expect(r).toContain("What this means for users")
    expect(r).toMatch(/Gatekeeper/i)
    expect(r).toMatch(/unidentified developer|cannot be opened/i)
  })

  test("Windows unsigned → SmartScreen warning text", () => {
    const r = generateReport(inp(SIGNED, UNSIGNED, SIGNED))
    expect(r).toContain("What this means for users")
    expect(r).toMatch(/SmartScreen/i)
    expect(r).toMatch(/Windows protected your PC|Run anyway/i)
  })

  test("Linux unsigned → unverifiable AppImage note", () => {
    const r = generateReport(inp(SIGNED, SIGNED, UNSIGNED))
    expect(r).toContain("What this means for users")
    expect(r).toMatch(/AppImage/i)
    expect(r).toMatch(/detached signature|unverifiable|cannot verify/i)
  })

  test("all unsigned → all three warnings present", () => {
    const r = generateReport(inp(UNSIGNED, UNSIGNED, UNSIGNED))
    expect(r).toMatch(/Gatekeeper/i)
    expect(r).toMatch(/SmartScreen/i)
    expect(r).toMatch(/AppImage/i)
  })
})

describe("generateReport — skipped (build not attempted) state", () => {
  test("skipped platform appears as skipped, not signed/unsigned", () => {
    const r = generateReport(inp(SKIPPED, SIGNED, SIGNED))
    expect(r).toMatch(/macOS.*skipped/i)
  })

  test("all skipped is still valid input", () => {
    const r = generateReport(inp(SKIPPED, SKIPPED, SKIPPED))
    expect(r).toMatch(/skipped/i)
    expect(r).not.toContain("All builds signed and verified")
  })
})

describe("generateReport — partial notarization (macOS signed, not notarized)", () => {
  test("signed-but-not-notarized flag downgrades the macOS line", () => {
    const r = generateReport({
      macos: "signed",
      windows: "signed",
      linux: "signed",
      macosNotarized: false,
    })
    expect(r).toMatch(/signed but not notarized|not notarized/i)
    // User still needs the Gatekeeper guidance in this state — the
    // first-launch prompt is different from unsigned but present.
    expect(r).toMatch(/Gatekeeper|first launch/i)
  })

  test("explicit macosNotarized: true on all-signed leaves happy path alone", () => {
    const r = generateReport({
      macos: "signed",
      windows: "signed",
      linux: "signed",
      macosNotarized: true,
    })
    expect(r).toContain("All builds signed and verified")
  })
})

describe("generateReport — all 2^3 combinations exhaustively", () => {
  // Exhaustively walk signed/unsigned across all 3 platforms. Not for
  // output matching — just that the function returns a non-empty string
  // for every valid input and emits a header for each platform.
  const states: PlatformStatus[] = ["signed", "unsigned"]
  for (const m of states) {
    for (const w of states) {
      for (const l of states) {
        test(`mac=${m}, win=${w}, linux=${l}`, () => {
          const r = generateReport(inp(m, w, l))
          expect(r.length).toBeGreaterThan(50)
          expect(r).toMatch(/macOS/i)
          expect(r).toMatch(/Windows/i)
          expect(r).toMatch(/Linux/i)
        })
      }
    }
  }
})

describe("generateReport — output shape", () => {
  test("output is valid markdown with a top-level header", () => {
    const r = generateReport(inp(SIGNED, UNSIGNED, UNSIGNED))
    expect(r).toMatch(/^## /m)
  })

  test("status lines use markdown emphasis or list markers", () => {
    const r = generateReport(inp(SIGNED, UNSIGNED, SIGNED))
    expect(r).toMatch(/^[-*] /m)
  })

  test("idempotent: same input → same output", () => {
    const a = generateReport(inp(UNSIGNED, SIGNED, UNSIGNED))
    const b = generateReport(inp(UNSIGNED, SIGNED, UNSIGNED))
    expect(a).toBe(b)
  })
})
