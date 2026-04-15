import { describe, expect, test } from "bun:test"
import { checkNavigation, isLocalHost, partitionKey } from "./partition"

describe("partitionKey", () => {
  test("deterministic for same (workspace, host)", () => {
    const a = partitionKey("ws-1", "127.0.0.1:3000")
    const b = partitionKey("ws-1", "127.0.0.1:3000")
    expect(a).toBe(b)
  })

  test("different workspaces produce different partitions", () => {
    expect(partitionKey("ws-1", "h")).not.toBe(partitionKey("ws-2", "h"))
  })

  test("different hosts produce different partitions", () => {
    expect(partitionKey("ws-1", "127.0.0.1")).not.toBe(partitionKey("ws-1", "localhost"))
  })

  test("case-insensitive host normalization", () => {
    expect(partitionKey("ws-1", "LOCALHOST:3000")).toBe(partitionKey("ws-1", "localhost:3000"))
  })

  test("rejects empty inputs", () => {
    expect(() => partitionKey("", "h")).toThrow()
    expect(() => partitionKey("w", "")).toThrow()
  })
})

describe("isLocalHost", () => {
  test("accepts 127.0.0.1 / localhost / ::1", () => {
    expect(isLocalHost("127.0.0.1")).toBe(true)
    expect(isLocalHost("localhost")).toBe(true)
    expect(isLocalHost("::1")).toBe(true)
    expect(isLocalHost("[::1]")).toBe(true)
  })
  test("rejects external hosts", () => {
    expect(isLocalHost("api.github.com")).toBe(false)
    expect(isLocalHost("evil.com")).toBe(false)
    expect(isLocalHost("127.0.0.1.evil.com")).toBe(false)
  })
})

describe("checkNavigation", () => {
  test("allows http://localhost:N", () => {
    const r = checkNavigation("http://localhost:3000/app")
    expect(r.allowed).toBe(true)
    expect(r.normalizedUrl).toBe("http://localhost:3000/app")
  })

  test("allows http://[::1]", () => {
    expect(checkNavigation("http://[::1]:8080").allowed).toBe(true)
  })

  test("rejects external https", () => {
    const r = checkNavigation("https://evil.com/")
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe("non-local-host")
  })

  test("rejects non-http schemes", () => {
    expect(checkNavigation("ftp://localhost").reason).toBe("non-http-protocol")
    expect(checkNavigation("file:///etc/passwd").reason).toBe("non-http-protocol")
  })

  test("rejects malformed URLs", () => {
    expect(checkNavigation("not a url").reason).toBe("invalid-url")
  })
})
