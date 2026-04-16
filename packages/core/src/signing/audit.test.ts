import { describe, expect, test } from "bun:test"
import { auditSigning, blockingIssues } from "./audit"

const fs = { exists: (p: string) => p === "/tmp/cert.pfx" }

describe("auditSigning — darwin", () => {
  test("missing APPLE_SIGNING_IDENTITY flagged", () => {
    const out = auditSigning({ platform: "darwin", env: {}, fs })
    const issue = out.find((r) => r.id === "apple-developer-id")
    expect(issue?.ok).toBe(false)
    expect(issue?.reason).toContain("APPLE_SIGNING_IDENTITY")
  })

  test("full darwin env → passes", () => {
    const out = auditSigning({
      platform: "darwin",
      env: {
        APPLE_SIGNING_IDENTITY: "Developer ID",
        APPLE_ID: "me@example.com",
        APPLE_TEAM_ID: "ABCDE12345",
        TAURI_UPDATER_PUBKEY: "pubkey-bytes",
      },
      fs,
    })
    expect(blockingIssues(out)).toEqual([])
  })
})

describe("auditSigning — win32", () => {
  test("missing pfx flagged", () => {
    const out = auditSigning({
      platform: "win32",
      env: { TAURI_UPDATER_PUBKEY: "x" },
      fs,
    })
    expect(out.find((r) => r.id === "windows-pfx")?.ok).toBe(false)
  })

  test("pfx path set but not on disk flagged", () => {
    const out = auditSigning({
      platform: "win32",
      env: { WINDOWS_PFX_PATH: "/missing/path.pfx", TAURI_UPDATER_PUBKEY: "x" },
      fs,
    })
    const issue = out.find((r) => r.id === "windows-pfx")
    expect(issue?.ok).toBe(false)
    expect(issue?.reason).toContain("missing on disk")
  })

  test("pfx present + updater pubkey → passes", () => {
    const out = auditSigning({
      platform: "win32",
      env: { WINDOWS_PFX_PATH: "/tmp/cert.pfx", TAURI_UPDATER_PUBKEY: "p" },
      fs,
    })
    expect(blockingIssues(out)).toEqual([])
  })
})

describe("auditSigning — linux", () => {
  test("missing GPG_KEY_ID flagged", () => {
    const out = auditSigning({ platform: "linux", env: {}, fs })
    expect(out.find((r) => r.id === "linux-gpg")?.ok).toBe(false)
  })
})

describe("updater pubkey cross-platform", () => {
  test("missing on any platform is blocking", () => {
    const out = auditSigning({
      platform: "linux",
      env: { GPG_KEY_ID: "k" },
      fs,
    })
    expect(out.find((r) => r.id === "updater-pubkey")?.ok).toBe(false)
  })
})
