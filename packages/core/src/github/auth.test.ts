import { describe, expect, test } from "bun:test"
import { GitHubAuth, InMemoryKeychain } from "./auth"

describe("GitHubAuth", () => {
  test("token from keychain is preferred over env", async () => {
    const k = new InMemoryKeychain()
    await k.write("github", "from-keychain")
    const auth = new GitHubAuth(k, { GITHUB_TOKEN: "from-env" })
    const out = await auth.resolveToken()
    expect(out.token).toBe("from-keychain")
    expect(out.source).toBe("keychain")
    expect(out.warning).toBeUndefined()
  })

  test("env fallback returns warning banner", async () => {
    const auth = new GitHubAuth(new InMemoryKeychain(), { GITHUB_TOKEN: "ghp_x" })
    const out = await auth.resolveToken()
    expect(out.source).toBe("env")
    expect(out.warning).toMatch(/keychain/)
  })

  test("GH_TOKEN is also picked up", async () => {
    const auth = new GitHubAuth(new InMemoryKeychain(), { GH_TOKEN: "y" })
    const out = await auth.resolveToken()
    expect(out.token).toBe("y")
    expect(out.source).toBe("env")
  })

  test("no token at all → missing", async () => {
    const auth = new GitHubAuth(new InMemoryKeychain(), {})
    const out = await auth.resolveToken()
    expect(out.token).toBe(null)
    expect(out.source).toBe("missing")
  })

  test("keychain throwing returns warning, no token", async () => {
    const broken = {
      read: () => Promise.reject(new Error("EACCES")),
      write: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    }
    const auth = new GitHubAuth(broken, { GITHUB_TOKEN: "shouldnt-fall-through" })
    const out = await auth.resolveToken()
    expect(out.token).toBe(null)
    expect(out.warning).toMatch(/keychain unavailable/)
  })

  test("storeToken writes to keychain", async () => {
    const k = new InMemoryKeychain()
    const auth = new GitHubAuth(k, {})
    await auth.storeToken("tok")
    expect(await k.read("github")).toBe("tok")
  })

  test("clearToken removes the entry", async () => {
    const k = new InMemoryKeychain()
    await k.write("github", "x")
    const auth = new GitHubAuth(k, {})
    await auth.clearToken()
    expect(await k.read("github")).toBe(null)
  })
})
