import { describe, expect, test } from "bun:test"
import {
  EXIT_BAD_ARGS,
  EXIT_CODESIGN_FAIL,
  EXIT_GATEKEEPER_FAIL,
  EXIT_MISSING_APP,
  EXIT_OK,
  parseSigningIdentityFromCodesignDv,
  verifySignedApp,
} from "./verify-signed-lib"

// Fixtures drawn from real `codesign -dv --verbose=4` output.
const CODESIGN_DV_OUT = `Executable=/Users/foo/dist/Coda.app/Contents/MacOS/Coda
Identifier=io.coda.desktop
Format=app bundle with Mach-O universal (x86_64 arm64)
CodeDirectory v=20500 size=XXXX flags=0x10000(runtime) hashes=XXXX+7 location=embedded
Hash type=sha256 size=32
CandidateCDHash sha256=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
Hash choices=sha256
Page size=4096
Authority=Developer ID Application: Jack Lau (95ZR2Y4GKR)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
Timestamp=Apr 16, 2026 at 12:00:00 PM
Info.plist entries=30
TeamIdentifier=95ZR2Y4GKR
Runtime Version=15.5.0
Sealed Resources version=2 rules=13 files=100
Internal requirements count=1 size=184
`

const CODESIGN_DV_UNSIGNED = `Executable=/tmp/foo.app/Contents/MacOS/foo
code object is not signed at all`

describe("parseSigningIdentityFromCodesignDv", () => {
  test("extracts first Authority=Developer ID Application line", () => {
    expect(parseSigningIdentityFromCodesignDv(CODESIGN_DV_OUT)).toBe(
      "Developer ID Application: Jack Lau (95ZR2Y4GKR)",
    )
  })

  test("returns null for unsigned output", () => {
    expect(parseSigningIdentityFromCodesignDv(CODESIGN_DV_UNSIGNED)).toBeNull()
  })

  test("returns null for empty input", () => {
    expect(parseSigningIdentityFromCodesignDv("")).toBeNull()
  })

  test("ignores non-Developer-ID Authority lines", () => {
    const out = "Authority=Apple Development: foo\nAuthority=Apple Root CA"
    expect(parseSigningIdentityFromCodesignDv(out)).toBeNull()
  })

  test("returns the Developer ID Application line even when other Authority lines surround it", () => {
    const out = `Authority=Apple Root CA
Authority=Developer ID Application: Foo Corp (ABCDEFGHIJ)
Authority=Developer ID Certification Authority`
    expect(parseSigningIdentityFromCodesignDv(out)).toBe(
      "Developer ID Application: Foo Corp (ABCDEFGHIJ)",
    )
  })
})

// verifySignedApp uses a pure env/spawn seam for deterministic tests.
describe("verifySignedApp", () => {
  test("missing app path → EXIT_BAD_ARGS", () => {
    const r = verifySignedApp({
      appPath: "",
      env: {
        fileExists: () => false,
        runCommand: () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    })
    expect(r.exitCode).toBe(EXIT_BAD_ARGS)
  })

  test("app does not exist → EXIT_MISSING_APP", () => {
    const r = verifySignedApp({
      appPath: "/nope/nonexistent.app",
      env: {
        fileExists: () => false,
        runCommand: () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    })
    expect(r.exitCode).toBe(EXIT_MISSING_APP)
    expect(r.error).toMatch(/not found/i)
  })

  test("codesign --verify fails → EXIT_CODESIGN_FAIL", () => {
    const r = verifySignedApp({
      appPath: "/dist/Coda.app",
      env: {
        fileExists: () => true,
        runCommand: (_cmd, args) => {
          if (args.includes("--verify")) {
            return { exitCode: 1, stdout: "", stderr: "codesign: invalid signature" }
          }
          return { exitCode: 0, stdout: "", stderr: "" }
        },
      },
    })
    expect(r.exitCode).toBe(EXIT_CODESIGN_FAIL)
    expect(r.error).toMatch(/invalid signature|codesign/i)
  })

  test("spctl --assess fails → EXIT_GATEKEEPER_FAIL", () => {
    const r = verifySignedApp({
      appPath: "/dist/Coda.app",
      env: {
        fileExists: () => true,
        runCommand: (_cmd, args) => {
          if (args.includes("--verify")) return { exitCode: 0, stdout: "valid", stderr: "" }
          if (args[0] === "-dv" || args.includes("-dv"))
            return { exitCode: 0, stdout: CODESIGN_DV_OUT, stderr: CODESIGN_DV_OUT }
          if (args.includes("--assess")) {
            return { exitCode: 3, stdout: "", stderr: "Gatekeeper rejected" }
          }
          return { exitCode: 0, stdout: "", stderr: "" }
        },
      },
    })
    expect(r.exitCode).toBe(EXIT_GATEKEEPER_FAIL)
    expect(r.error).toMatch(/Gatekeeper/i)
  })

  test("everything passes → EXIT_OK with identity", () => {
    const r = verifySignedApp({
      appPath: "/dist/Coda.app",
      env: {
        fileExists: () => true,
        runCommand: (_cmd, args) => {
          if (args.includes("--verify")) return { exitCode: 0, stdout: "valid", stderr: "" }
          if (args.includes("-dv") || args.includes("--display"))
            return { exitCode: 0, stdout: CODESIGN_DV_OUT, stderr: CODESIGN_DV_OUT }
          if (args.includes("--assess"))
            return { exitCode: 0, stdout: "accepted", stderr: "source=Developer ID" }
          return { exitCode: 0, stdout: "", stderr: "" }
        },
      },
    })
    expect(r.exitCode).toBe(EXIT_OK)
    expect(r.identity).toBe("Developer ID Application: Jack Lau (95ZR2Y4GKR)")
  })

  test("identity is parsed from stderr too (codesign -dv writes to stderr on real macs)", () => {
    const r = verifySignedApp({
      appPath: "/dist/Coda.app",
      env: {
        fileExists: () => true,
        runCommand: (_cmd, args) => {
          if (args.includes("--verify")) return { exitCode: 0, stdout: "", stderr: "" }
          if (args.includes("-dv") || args.includes("--display"))
            return { exitCode: 0, stdout: "", stderr: CODESIGN_DV_OUT }
          if (args.includes("--assess")) return { exitCode: 0, stdout: "", stderr: "" }
          return { exitCode: 0, stdout: "", stderr: "" }
        },
      },
    })
    expect(r.exitCode).toBe(EXIT_OK)
    expect(r.identity).toBe("Developer ID Application: Jack Lau (95ZR2Y4GKR)")
  })
})
