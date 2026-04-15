import { describe, expect, test } from "bun:test"
import { scrubSecretEnv } from "./index"

describe("scrubSecretEnv", () => {
  test("removes ANTHROPIC_API_KEY", () => {
    const out = scrubSecretEnv({ ANTHROPIC_API_KEY: "sk-x", PATH: "/usr/bin" })
    expect(out.ANTHROPIC_API_KEY).toBeUndefined()
    expect(out.PATH).toBe("/usr/bin")
  })

  test("removes GITHUB_TOKEN and GH_TOKEN", () => {
    const out = scrubSecretEnv({ GITHUB_TOKEN: "x", GH_TOKEN: "y", USER: "alice" })
    expect(out.GITHUB_TOKEN).toBeUndefined()
    expect(out.GH_TOKEN).toBeUndefined()
    expect(out.USER).toBe("alice")
  })

  test("removes anything matching AWS_*", () => {
    const out = scrubSecretEnv({ AWS_SECRET_ACCESS_KEY: "x", AWS_REGION: "us-west-2" })
    expect(out.AWS_SECRET_ACCESS_KEY).toBeUndefined()
    expect(out.AWS_REGION).toBeUndefined()
  })

  test("removes CODA_*_SECRET pattern", () => {
    const out = scrubSecretEnv({ CODA_GITHUB_SECRET: "x", CODA_PUBLIC_URL: "y" })
    expect(out.CODA_GITHUB_SECRET).toBeUndefined()
    expect(out.CODA_PUBLIC_URL).toBe("y")
  })

  test("drops undefined values", () => {
    const out = scrubSecretEnv({ FOO: undefined, BAR: "1" })
    expect("FOO" in out).toBe(false)
    expect(out.BAR).toBe("1")
  })
})
