import { describe, expect, test } from "bun:test"
import { auditSigningEnv, formatReport } from "./signing-audit"

describe("auditSigningEnv", () => {
  test("fully signed env — all green, exit 0", () => {
    const r = auditSigningEnv({
      CODA_APPLE_DEV_ID: "Developer ID Application: Coda Inc (TEAM123)",
      CODA_APPLE_PROVIDER: "TEAM123",
      CODA_APPLE_ID: "ci@coda.io",
      CODA_APPLE_TEAM_ID: "TEAM123",
      CODA_APPLE_APP_PASSWORD: "app-specific-pw",
      CODA_WIN_CERT_THUMBPRINT: "A1B2C3D4E5",
      CODA_GPG_KEY_ID: "ABCDEF01",
      CODA_REQUIRE_SIGNED: "1",
    })
    expect(r.allSigned).toBe(true)
    expect(r.exitCode).toBe(0)
    for (const p of r.results) expect(p.status).toBe("signed")
  })

  test("dev env (nothing set) — unsigned, exit 0 because require=0", () => {
    const r = auditSigningEnv({})
    expect(r.allSigned).toBe(false)
    expect(r.exitCode).toBe(0)
    expect(r.results.find((p) => p.platform === "macos")?.status).toBe("unsigned")
    expect(r.results.find((p) => p.platform === "windows")?.status).toBe("unsigned")
    expect(r.results.find((p) => p.platform === "linux")?.status).toBe("unsigned")
  })

  test("require=1 but nothing set — exit 2", () => {
    const r = auditSigningEnv({ CODA_REQUIRE_SIGNED: "1" })
    expect(r.exitCode).toBe(2)
    expect(r.allSigned).toBe(false)
  })

  test("macOS signed but partial notarization creds — flagged as signed-but-incomplete", () => {
    const r = auditSigningEnv({
      CODA_APPLE_DEV_ID: "x",
      CODA_APPLE_PROVIDER: "y",
      CODA_APPLE_ID: "z", // only one of 3 notarize vars
    })
    const mac = r.results.find((p) => p.platform === "macos")!
    expect(mac.status).toBe("signed")
    expect(mac.reason).toMatch(/Partial notarization/)
    expect(mac.missing).toContain("CODA_APPLE_TEAM_ID")
    expect(mac.missing).toContain("CODA_APPLE_APP_PASSWORD")
  })

  test("windows signed when thumbprint set", () => {
    const r = auditSigningEnv({ CODA_WIN_CERT_THUMBPRINT: "ABCD" })
    const win = r.results.find((p) => p.platform === "windows")!
    expect(win.status).toBe("signed")
    expect(win.missing).toHaveLength(0)
  })

  test("linux signed when GPG key set", () => {
    const r = auditSigningEnv({ CODA_GPG_KEY_ID: "KEY123" })
    const lin = r.results.find((p) => p.platform === "linux")!
    expect(lin.status).toBe("signed")
  })

  test("formatReport emits readable lines", () => {
    const r = auditSigningEnv({})
    const out = formatReport(r)
    expect(out).toContain("=== Coda Signing Audit ===")
    expect(out).toContain("macos")
    expect(out).toContain("windows")
    expect(out).toContain("linux")
    expect(out).toContain("unsigned")
  })

  test("formatReport reports FAIL when require=1 and missing", () => {
    const r = auditSigningEnv({ CODA_REQUIRE_SIGNED: "1" })
    expect(formatReport(r)).toContain("FAIL")
  })

  test("formatReport reports success when all signed", () => {
    const r = auditSigningEnv({
      CODA_APPLE_DEV_ID: "x",
      CODA_APPLE_PROVIDER: "y",
      CODA_APPLE_ID: "z",
      CODA_APPLE_TEAM_ID: "t",
      CODA_APPLE_APP_PASSWORD: "p",
      CODA_WIN_CERT_THUMBPRINT: "w",
      CODA_GPG_KEY_ID: "g",
    })
    expect(formatReport(r)).toContain("All platforms signed")
  })
})
