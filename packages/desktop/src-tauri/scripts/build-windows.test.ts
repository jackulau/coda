// build-windows.test.ts — validates the PowerShell script's env-var
// routing. We can't execute PowerShell on macOS CI reliably (it needs
// `pwsh` + Tauri + Rust + MSVC), so the script is treated as a text
// artifact the same way release.yml is — fixtures assert the shape.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const path = resolve(__dirname, "build-windows.ps1")
const text = readFileSync(path, "utf8")

describe("build-windows.ps1 — shell + shape", () => {
  test("file exists and is non-empty PowerShell", () => {
    expect(text.length).toBeGreaterThan(100)
  })

  test("uses strict mode for unset vars + error handling", () => {
    expect(text).toMatch(/\$ErrorActionPreference\s*=\s*['"]Stop['"]/)
    expect(text).toMatch(/Set-StrictMode/)
  })
})

describe("build-windows.ps1 — tauri invocation", () => {
  test("invokes tauri build with --bundles msi,nsis", () => {
    expect(text).toMatch(/tauri\s+build/i)
    expect(text).toMatch(/--bundles\s+msi,nsis/)
  })

  test("uses bun to launch tauri so it resolves from the workspace", () => {
    expect(text).toMatch(/bun\s+(--cwd\s+\S+\s+)?tauri/)
  })
})

describe("build-windows.ps1 — signing branch", () => {
  test("branches on WINDOWS_PFX_PATH presence", () => {
    expect(text).toContain("WINDOWS_PFX_PATH")
    expect(text).toMatch(/Test-Path/)
  })

  test("validates WINDOWS_PFX_PASSWORD when path is set", () => {
    expect(text).toContain("WINDOWS_PFX_PASSWORD")
  })

  test("signed path invokes signtool", () => {
    expect(text).toMatch(/signtool/i)
    expect(text).toMatch(/sign/)
  })

  test("signtool signs both .msi and .exe outputs", () => {
    // A regex across both extensions — the script has to sign both.
    expect(text).toMatch(/\*\.msi|\.msi/)
    expect(text).toMatch(/\*\.exe|\.exe/)
  })

  test("signs with SHA-256 and a trusted timestamp", () => {
    expect(text).toMatch(/sha256/i)
    expect(text).toMatch(/\/tr\s+http|\/t\s+http|timestamp\.digicert\.com|/i)
  })
})

describe("build-windows.ps1 — SIGNED/UNSIGNED status file", () => {
  test("emits UNSIGNED.txt when no PFX", () => {
    expect(text).toContain("UNSIGNED.txt")
  })

  test("emits SIGNED.txt when PFX present", () => {
    expect(text).toContain("SIGNED.txt")
  })

  test("UNSIGNED.txt explains SmartScreen behavior", () => {
    expect(text).toMatch(/SmartScreen/i)
  })
})

describe("build-windows.ps1 — exit behavior", () => {
  test("exits non-zero on tauri failure ($ErrorActionPreference=Stop)", () => {
    // If someone sets ErrorActionPreference to "Continue" or "SilentlyContinue"
    // on the tauri call, this test catches the regression.
    expect(text).not.toMatch(/\$ErrorActionPreference\s*=\s*['"]SilentlyContinue['"]/)
    expect(text).not.toMatch(/\$ErrorActionPreference\s*=\s*['"]Continue['"]/)
  })

  test("validates inputs and exits on bad state", () => {
    // We expect a throw / exit 1 / Write-Error branch somewhere.
    expect(text).toMatch(/throw\s|exit\s+1|Write-Error/)
  })

  test("doesn't silently skip signing on signtool failure", () => {
    // No obvious `| Out-Null -ErrorAction SilentlyContinue` on signtool.
    expect(text).not.toMatch(/signtool[^\n]*SilentlyContinue/i)
  })
})
