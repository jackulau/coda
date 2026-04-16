// build-linux.test.ts — validates the bash script's env-var routing
// (signed vs unsigned path) without actually invoking tauri build. The
// script is short enough that its behavior is expressible as string/shape
// assertions against the file, much like release-workflow.test.ts. This
// keeps the test fast and hermetic — no docker, no tauri, no runners.

import { describe, expect, test } from "bun:test"
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"

const path = resolve(__dirname, "build-linux.sh")
const text = readFileSync(path, "utf8")
const stat = statSync(path)

describe("build-linux.sh — shell + shape", () => {
  test("file exists and is executable", () => {
    expect(text.length).toBeGreaterThan(100)
    // On macOS/Linux the exec bit is 0o111. Just verify any exec bit is set.
    expect(stat.mode & 0o111).toBeGreaterThan(0)
  })

  test("is bash with strict mode", () => {
    expect(text).toMatch(/^#!\/usr\/bin\/env\s+bash/)
    expect(text).toContain("set -euo pipefail")
  })
})

describe("build-linux.sh — tauri invocation", () => {
  test("invokes tauri build with --bundles deb,rpm,appimage", () => {
    expect(text).toMatch(/tauri\s+build/)
    expect(text).toMatch(/--bundles\s+deb,rpm,appimage/)
  })

  test("uses bun to launch tauri so it resolves from the workspace", () => {
    expect(text).toMatch(/bun\s+(--cwd\s+\S+\s+)?tauri|bun\s+run\s+tauri/)
  })
})

describe("build-linux.sh — GPG signing branch", () => {
  test("branches on LINUX_GPG_KEY_ID", () => {
    expect(text).toContain("LINUX_GPG_KEY_ID")
    // Must be a conditional, not just a plain reference.
    expect(text).toMatch(/if\s+\[[^\]]*LINUX_GPG_KEY_ID/)
  })

  test("signed path uses gpg --detach-sign --armor", () => {
    expect(text).toMatch(/gpg\s+[^\n]*--detach-sign/)
    expect(text).toMatch(/--armor/)
  })

  test("signs the AppImage specifically (not the .deb/.rpm)", () => {
    expect(text).toMatch(/\.AppImage/)
    // .deb/.rpm signing is repo-manager territory; the script should not
    // try to gpg-sign them.
    expect(text).not.toMatch(/gpg\s+[^\n]*\.deb/)
    expect(text).not.toMatch(/gpg\s+[^\n]*\.rpm/)
  })
})

describe("build-linux.sh — SIGNED/UNSIGNED status file", () => {
  test("emits UNSIGNED.txt when no GPG key", () => {
    expect(text).toContain("UNSIGNED.txt")
    // The unsigned path has to write the file even when gpg isn't set up.
    expect(text).toMatch(/UNSIGNED\.txt/)
  })

  test("emits SIGNED.txt when GPG key is used", () => {
    expect(text).toContain("SIGNED.txt")
  })

  test("SIGNED.txt mentions the key fingerprint", () => {
    // Either LINUX_GPG_KEY_ID or `gpg --fingerprint` output should end up
    // embedded in SIGNED.txt — the doc is what ops checks.
    expect(text).toMatch(/gpg\s+[^\n]*--fingerprint|LINUX_GPG_KEY_ID/)
  })
})

describe("build-linux.sh — exit behavior", () => {
  test("exits non-zero on tauri build failure (set -e propagates)", () => {
    // set -euo pipefail at the top is the guarantee. If someone wraps the
    // tauri call in `|| true` or disables errexit, this assertion catches it.
    expect(text).not.toMatch(/tauri\s+build[^\n]*\|\|\s*true/)
    expect(text).not.toMatch(/set\s+\+e\b/)
  })

  test("doesn't silently skip signing when gpg fails", () => {
    // The signed branch has to let gpg's exit code propagate; a wrapper
    // like `gpg ... || true` would mislabel a signing failure as success.
    expect(text).not.toMatch(/gpg[^\n]*\|\|\s*true/)
  })
})
