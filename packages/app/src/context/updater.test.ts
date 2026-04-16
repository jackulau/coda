import { describe, expect, test } from "bun:test"
import { compareSemver, parseSemver, selectUpdate } from "@coda/core/update/channel"

describe("updater context (X2)", () => {
  test("parseSemver reads a standard version string", () => {
    const v = parseSemver("2.0.1")
    expect(v).toEqual({ major: 2, minor: 0, patch: 1 })
  })

  test("compareSemver orders older < newer", () => {
    expect(compareSemver({ major: 2, minor: 0, patch: 0 }, { major: 2, minor: 0, patch: 1 })).toBe(
      -1,
    )
  })

  test("selectUpdate returns the newest-compatible release", () => {
    const rel = selectUpdate({
      current: { version: "2.0.0", channel: "stable", arch: "arm64", os: "darwin" },
      available: [
        {
          version: "2.0.1",
          channel: "stable",
          os: "darwin",
          arch: "arm64",
          publishedAt: 0,
        },
        {
          version: "2.1.0",
          channel: "canary",
          os: "darwin",
          arch: "arm64",
          publishedAt: 0,
        },
      ],
    })
    expect(rel?.version).toBe("2.0.1")
  })

  test("selectUpdate returns null when nothing newer", () => {
    const rel = selectUpdate({
      current: { version: "3.0.0", channel: "stable", arch: "arm64", os: "darwin" },
      available: [
        {
          version: "2.0.1",
          channel: "stable",
          os: "darwin",
          arch: "arm64",
          publishedAt: 0,
        },
      ],
    })
    expect(rel).toBeNull()
  })
})
