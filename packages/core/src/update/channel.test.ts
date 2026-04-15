import { describe, expect, test } from "bun:test"
import { type UpdateRelease, compareSemver, parseSemver, selectUpdate } from "./channel"

describe("parseSemver", () => {
  test("parses 1.2.3", () => {
    expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 })
  })
  test("parses 2.0.0-beta.1", () => {
    expect(parseSemver("2.0.0-beta.1")).toEqual({
      major: 2,
      minor: 0,
      patch: 0,
      pre: "beta.1",
    })
  })
  test("returns null on garbage", () => {
    expect(parseSemver("not a version")).toBeNull()
  })
})

describe("compareSemver", () => {
  const must = (s: string) => {
    const v = parseSemver(s)
    if (!v) throw new Error(`bad semver: ${s}`)
    return v
  }
  test("major dominates minor", () => {
    expect(compareSemver(must("2.0.0"), must("1.99.99"))).toBeGreaterThan(0)
  })
  test("pre-release < release of same triple", () => {
    expect(compareSemver(must("2.0.0"), must("2.0.0-beta.1"))).toBeGreaterThan(0)
  })
  test("identical → 0", () => {
    expect(compareSemver(must("1.2.3"), must("1.2.3"))).toBe(0)
  })
})

const release = (overrides: Partial<UpdateRelease>): UpdateRelease => ({
  version: "2.0.1",
  channel: "stable",
  arch: "arm64",
  os: "darwin",
  publishedAt: 0,
  ...overrides,
})

describe("selectUpdate", () => {
  test("picks highest stable when on stable", () => {
    const out = selectUpdate({
      current: { version: "2.0.0", channel: "stable", arch: "arm64", os: "darwin" },
      available: [release({ version: "2.0.1" }), release({ version: "2.0.5" })],
    })
    expect(out?.version).toBe("2.0.5")
  })

  test("does not offer beta to stable user", () => {
    const out = selectUpdate({
      current: { version: "2.0.0", channel: "stable", arch: "arm64", os: "darwin" },
      available: [release({ version: "2.1.0", channel: "beta" })],
    })
    expect(out).toBeNull()
  })

  test("offers beta + stable to beta user, prefers higher version", () => {
    const out = selectUpdate({
      current: { version: "2.0.0", channel: "beta", arch: "arm64", os: "darwin" },
      available: [
        release({ version: "2.0.1", channel: "stable" }),
        release({ version: "2.1.0-beta.1", channel: "beta" }),
      ],
    })
    expect(out?.version).toBe("2.1.0-beta.1")
  })

  test("filters by arch + os", () => {
    const out = selectUpdate({
      current: { version: "2.0.0", channel: "stable", arch: "arm64", os: "darwin" },
      available: [
        release({ version: "2.0.1", arch: "x64" }),
        release({ version: "2.0.2", os: "linux" }),
      ],
    })
    expect(out).toBeNull()
  })

  test("does not offer downgrade", () => {
    const out = selectUpdate({
      current: { version: "3.0.0", channel: "stable", arch: "arm64", os: "darwin" },
      available: [release({ version: "2.0.5" })],
    })
    expect(out).toBeNull()
  })
})
