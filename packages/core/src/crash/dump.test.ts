import { describe, expect, test } from "bun:test"
import { CrashIndex, buildDump, redactDump } from "./dump"

describe("buildDump", () => {
  test("populates required fields + generates id", () => {
    const d = buildDump({
      origin: "renderer",
      appVersion: "2.0.0",
      platform: "darwin",
      arch: "arm64",
      message: "boom",
    })
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(d.origin).toBe("renderer")
    expect(d.stack).toBe(null)
  })

  test("rejects unknown origin", () => {
    expect(() =>
      buildDump({
        origin: "unknown" as unknown as "renderer",
        appVersion: "2.0.0",
        platform: "darwin",
        arch: "arm64",
        message: "x",
      }),
    ).toThrow()
  })
})

describe("redactDump", () => {
  test("strips secrets from message + stack", () => {
    const d = buildDump({
      origin: "sidecar",
      appVersion: "2.0.0",
      platform: "linux",
      arch: "x64",
      message: "token=ghp_1234567890abcdefghij leaked",
      stack: "Error at token ghp_1234567890abcdefghij",
    })
    const out = redactDump(d)
    expect(out.message).not.toContain("ghp_1234567890abcdefghij")
    expect(out.stack).not.toContain("ghp_1234567890abcdefghij")
    expect(out.message).toContain("<redacted>")
  })
})

describe("CrashIndex", () => {
  test("add + list orders newest first", () => {
    const idx = new CrashIndex()
    idx.add(
      buildDump(
        { origin: "rust", appVersion: "1", platform: "linux", arch: "x64", message: "a" },
        100,
      ),
    )
    idx.add(
      buildDump(
        { origin: "rust", appVersion: "1", platform: "linux", arch: "x64", message: "b" },
        200,
      ),
    )
    expect(idx.list().map((d) => d.message)).toEqual(["b", "a"])
  })

  test("cap drops oldest when over max", () => {
    const idx = new CrashIndex(2)
    idx.add(
      buildDump(
        { origin: "rust", appVersion: "1", platform: "linux", arch: "x64", message: "a" },
        100,
      ),
    )
    idx.add(
      buildDump(
        { origin: "rust", appVersion: "1", platform: "linux", arch: "x64", message: "b" },
        200,
      ),
    )
    idx.add(
      buildDump(
        { origin: "rust", appVersion: "1", platform: "linux", arch: "x64", message: "c" },
        300,
      ),
    )
    expect(idx.size()).toBe(2)
    expect(
      idx
        .list()
        .map((d) => d.message)
        .sort(),
    ).not.toContain("a")
  })

  test("filterByOrigin narrows correctly", () => {
    const idx = new CrashIndex()
    idx.add(
      buildDump({
        origin: "renderer",
        appVersion: "1",
        platform: "linux",
        arch: "x64",
        message: "r",
      }),
    )
    idx.add(
      buildDump({
        origin: "sidecar",
        appVersion: "1",
        platform: "linux",
        arch: "x64",
        message: "s",
      }),
    )
    expect(idx.filterByOrigin("sidecar").map((d) => d.message)).toEqual(["s"])
  })
})
