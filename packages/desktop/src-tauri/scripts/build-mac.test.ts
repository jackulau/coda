import { describe, expect, test } from "bun:test"
import {
  extractTeamId,
  parseFirstDeveloperIdIdentity,
  pickSigningIdentity,
  resolveBuildTarget,
} from "./build-mac-lib"

const FIXTURE_FULL = `Policy: Code Signing
  Matching identities
  1) AAAA1111AAAA1111AAAA1111AAAA1111AAAA1111 "Apple Development: ci@example.com (AB12CD34EF)"
  2) BBBB2222BBBB2222BBBB2222BBBB2222BBBB2222 "Developer ID Application: Jack Lau (95ZR2Y4GKR)"
  3) CCCC3333CCCC3333CCCC3333CCCC3333CCCC3333 "Developer ID Application: Other Company (ABCDE12345)"
     3 identities found
  Valid identities only
  2 valid identities found`

const FIXTURE_ONLY_DEVELOPMENT = `Policy: Code Signing
  Matching identities
  1) AAAA1111AAAA1111AAAA1111AAAA1111AAAA1111 "Apple Development: ci@example.com (AB12CD34EF)"
     1 identity found`

const FIXTURE_EMPTY = `Policy: Code Signing
  Matching identities
     0 identities found`

describe("parseFirstDeveloperIdIdentity", () => {
  test("extracts first Developer ID Application identity in order", () => {
    expect(parseFirstDeveloperIdIdentity(FIXTURE_FULL)).toBe(
      "Developer ID Application: Jack Lau (95ZR2Y4GKR)",
    )
  })

  test("returns null when only Apple Development identities present", () => {
    expect(parseFirstDeveloperIdIdentity(FIXTURE_ONLY_DEVELOPMENT)).toBeNull()
  })

  test("returns null when no identities", () => {
    expect(parseFirstDeveloperIdIdentity(FIXTURE_EMPTY)).toBeNull()
  })

  test("handles empty string", () => {
    expect(parseFirstDeveloperIdIdentity("")).toBeNull()
  })

  test("ignores Mac Developer / Apple Distribution lines", () => {
    const txt = `  1) ABCD "Mac Developer: foo (X1)"
  2) EFGH "Apple Distribution: bar (Y2)"
  3) IJKL "Developer ID Application: Jack Lau (95ZR2Y4GKR)"`
    expect(parseFirstDeveloperIdIdentity(txt)).toBe(
      "Developer ID Application: Jack Lau (95ZR2Y4GKR)",
    )
  })
})

describe("extractTeamId", () => {
  test("extracts 10-char team ID from CN", () => {
    expect(extractTeamId("Developer ID Application: Jack Lau (95ZR2Y4GKR)")).toBe("95ZR2Y4GKR")
  })

  test("returns null if no team ID in parens", () => {
    expect(extractTeamId("Developer ID Application: Jack Lau")).toBeNull()
  })

  test("returns null on empty string", () => {
    expect(extractTeamId("")).toBeNull()
  })

  test("handles names with parens in them", () => {
    expect(extractTeamId("Developer ID Application: A (B) Co (ABCDEFGHIJ)")).toBe("ABCDEFGHIJ")
  })
})

describe("pickSigningIdentity — override priority", () => {
  test("env CODA_APPLE_DEV_ID wins over keychain discovery", () => {
    const picked = pickSigningIdentity({
      envOverride: "Developer ID Application: Override Co (ZZZZZZZZZZ)",
      keychainOutput: FIXTURE_FULL,
    })
    expect(picked.identity).toBe("Developer ID Application: Override Co (ZZZZZZZZZZ)")
    expect(picked.source).toBe("env")
    expect(picked.teamId).toBe("ZZZZZZZZZZ")
  })

  test("falls back to keychain when no env override", () => {
    const picked = pickSigningIdentity({ keychainOutput: FIXTURE_FULL })
    expect(picked.identity).toBe("Developer ID Application: Jack Lau (95ZR2Y4GKR)")
    expect(picked.source).toBe("keychain")
    expect(picked.teamId).toBe("95ZR2Y4GKR")
  })

  test("returns null identity when neither env nor keychain provides one", () => {
    const picked = pickSigningIdentity({ keychainOutput: FIXTURE_EMPTY })
    expect(picked.identity).toBeNull()
    expect(picked.source).toBe("none")
    expect(picked.teamId).toBeNull()
  })

  test("empty env override is ignored (treated as not set)", () => {
    const picked = pickSigningIdentity({ envOverride: "", keychainOutput: FIXTURE_FULL })
    expect(picked.source).toBe("keychain")
    expect(picked.identity).toBe("Developer ID Application: Jack Lau (95ZR2Y4GKR)")
  })
})

describe("resolveBuildTarget", () => {
  test("default is universal-apple-darwin", () => {
    expect(resolveBuildTarget(undefined)).toBe("universal-apple-darwin")
  })

  test("arm64 env switches to aarch64-apple-darwin", () => {
    expect(resolveBuildTarget("arm64")).toBe("aarch64-apple-darwin")
  })

  test("x64 env switches to x86_64-apple-darwin", () => {
    expect(resolveBuildTarget("x64")).toBe("x86_64-apple-darwin")
  })

  test("unknown value falls back to universal", () => {
    expect(resolveBuildTarget("wat")).toBe("universal-apple-darwin")
  })
})
