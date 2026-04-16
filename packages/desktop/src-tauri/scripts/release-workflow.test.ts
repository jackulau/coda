// release-workflow.test.ts — structural validation of the GitHub Actions
// workflow that performs the signed macOS release. We parse the YAML and
// assert the shape we depend on (runner, triggers, secret usage, uploaded
// artifact), since this workflow isn't going to actually run in CI until
// the secrets are set — the test keeps us from regressing the file.

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// Minimal YAML parse: we only need to assert substrings since a full parser
// isn't a dep. The structural rules we care about are expressible as
// presence/absence of specific lines.

const path = resolve(__dirname, "../../../../.github/workflows/release-macos.yml")
const text = readFileSync(path, "utf8")

describe("release-macos.yml — structural", () => {
  test("exists and is non-empty", () => {
    expect(text.length).toBeGreaterThan(500)
  })

  test("runs on push tag v*", () => {
    expect(text).toMatch(/push:\s*\n\s*tags:\s*\n\s*-\s*["']?v\*["']?/m)
  })

  test("runner is macos-14 (Apple Silicon)", () => {
    expect(text).toMatch(/runs-on:\s*macos-14/)
  })

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

  test("uploads the .dmg as a release asset", () => {
    expect(text).toContain("softprops/action-gh-release")
    expect(text).toMatch(/files:\s*\|[\s\S]*\.dmg/)
  })

  test("smoke-verifies universal Mach-O (x64 + arm64)", () => {
    expect(text).toContain("lipo -archs")
    expect(text).toMatch(/x86_64/)
    expect(text).toMatch(/arm64/)
  })

  test("references the universal target triple (covers x64 + arm64)", () => {
    expect(text).toMatch(/aarch64-apple-darwin/)
    expect(text).toMatch(/x86_64-apple-darwin/)
  })

  test("no hard-coded passwords / identities — everything from secrets", () => {
    // Sanity: make sure the workflow doesn't accidentally embed a literal
    // Developer ID Application CN or Apple Team ID.
    expect(text).not.toContain("95ZR2Y4GKR")
    expect(text).not.toMatch(/Developer ID Application:\s*[A-Za-z]/)
  })
})
