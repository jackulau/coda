// release-workflow.test.ts — structural validation of the unified cross-
// platform release workflow. We parse the YAML-as-text and assert the shape
// we depend on (triggers, 3-OS matrix, per-platform signing branches, artifact
// upload). This workflow won't actually run in CI until a v* tag is pushed —
// the test is our regression net so the file doesn't drift.

import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const repoRoot = resolve(__dirname, "../../../..")
const unifiedPath = resolve(repoRoot, ".github/workflows/release.yml")
const legacyMacPath = resolve(repoRoot, ".github/workflows/release-macos.yml")
const text = readFileSync(unifiedPath, "utf8")

describe("release.yml — exists + shape", () => {
  test("unified release.yml exists and is non-empty", () => {
    expect(text.length).toBeGreaterThan(500)
  })

  test("runs on push tag v*", () => {
    expect(text).toMatch(/push:\s*\n\s*tags:\s*\n\s*-\s*["']?v\*["']?/m)
  })

  test("legacy release-macos.yml was retired", () => {
    expect(existsSync(legacyMacPath)).toBe(false)
  })
})

describe("release.yml — 3-OS matrix", () => {
  test("defines a strategy.matrix with all three OSes", () => {
    expect(text).toMatch(/strategy:\s*\n\s*fail-fast:\s*false/)
    expect(text).toContain("matrix:")
    expect(text).toContain("macos-14")
    expect(text).toContain("ubuntu-22.04")
    expect(text).toContain("windows-latest")
  })

  test("fail-fast: false so one OS's failure does not cancel the others", () => {
    expect(text).toMatch(/fail-fast:\s*false/)
  })

  test("references all three rustc target triples", () => {
    expect(text).toContain("universal-apple-darwin")
    expect(text).toContain("x86_64-unknown-linux-gnu")
    expect(text).toContain("x86_64-pc-windows-msvc")
  })

  test("runs-on uses the matrix os", () => {
    expect(text).toMatch(/runs-on:\s*\$\{\{\s*matrix\.os\s*\}\}/)
  })
})

describe("release.yml — shared setup", () => {
  test("checkout + bun + rust toolchain all present", () => {
    expect(text).toContain("actions/checkout@v4")
    expect(text).toContain("oven-sh/setup-bun")
    expect(text).toContain("dtolnay/rust-toolchain")
  })

  test("installs bun dependencies once", () => {
    expect(text).toMatch(/bun\s+install/)
  })
})

describe("release.yml — macOS signing path", () => {
  test("restores cert from APPLE_CERT_P12_BASE64 secret into a keychain", () => {
    expect(text).toContain("APPLE_CERT_P12_BASE64")
    expect(text).toContain("APPLE_CERT_P12_PASSWORD")
    expect(text).toMatch(/security\s+create-keychain/)
    expect(text).toMatch(/security\s+import/)
  })

  test("sets signing + notarization env from secrets", () => {
    expect(text).toContain("APPLE_SIGNING_IDENTITY")
    expect(text).toContain("APPLE_TEAM_ID")
    expect(text).toContain("APPLE_ID")
    expect(text).toContain("APPLE_APP_PASSWORD")
  })

  test("invokes build-mac.sh, verify-signed.sh, notarize-credentials.sh, notarize.ts", () => {
    expect(text).toContain("scripts/build-mac.sh")
    expect(text).toContain("scripts/verify-signed.sh")
    expect(text).toContain("scripts/notarize-credentials.sh")
    expect(text).toContain("scripts/notarize.ts")
  })

  test("smoke-verifies universal Mach-O (x64 + arm64)", () => {
    expect(text).toContain("lipo -archs")
    expect(text).toMatch(/x86_64/)
    expect(text).toMatch(/arm64/)
  })
})

describe("release.yml — Windows path", () => {
  test("invokes build-windows.ps1", () => {
    expect(text).toContain("scripts/build-windows.ps1")
  })

  test("references WINDOWS_PFX_BASE64 + WINDOWS_PFX_PASSWORD secrets", () => {
    expect(text).toContain("WINDOWS_PFX_BASE64")
    expect(text).toContain("WINDOWS_PFX_PASSWORD")
  })

  test("has an explicit unsigned-build warning step", () => {
    // A step that either echoes/logs a warning when the PFX secret is missing
    // so maintainers can tell at a glance the artifact is unsigned.
    expect(text).toMatch(/unsigned/i)
    expect(text).toMatch(/SmartScreen|warning/i)
  })
})

describe("release.yml — Linux path", () => {
  test("invokes build-linux.sh", () => {
    expect(text).toContain("scripts/build-linux.sh")
  })

  test("references LINUX_GPG_KEY_BASE64 secret for AppImage signing", () => {
    expect(text).toContain("LINUX_GPG_KEY_BASE64")
  })

  test("builds deb, rpm, appimage bundles", () => {
    // The build-linux.sh wrapper enforces this at runtime, but the workflow
    // should also mention them so a reader can tell without opening the
    // script.
    expect(text).toMatch(/deb/i)
    expect(text).toMatch(/rpm/i)
    expect(text).toMatch(/appimage/i)
  })
})

describe("release.yml — artifact upload", () => {
  test("uploads to the GitHub release matching the tag", () => {
    expect(text).toContain("softprops/action-gh-release")
  })

  test("upload step references platform artifacts", () => {
    // The upload step collects artifacts from all runners. We expect at
    // least one reference to each bundle family.
    expect(text).toMatch(/\.dmg/)
    expect(text).toMatch(/\.(msi|exe)/)
    expect(text).toMatch(/\.(deb|rpm|AppImage)/i)
  })
})

describe("release.yml — no hard-coded secrets", () => {
  test("does not embed a literal Apple team id or CN", () => {
    expect(text).not.toContain("95ZR2Y4GKR")
    expect(text).not.toMatch(/Developer ID Application:\s*[A-Za-z]/)
  })
})
