import { describe, expect, test } from "bun:test"
import { Browser } from "@coda/core"

describe("browser tab isolation (F-extra)", () => {
  test("each workspace gets a distinct partition for the same host", () => {
    const a = Browser.partitionKey("workspace-a", "localhost:3000")
    const b = Browser.partitionKey("workspace-b", "localhost:3000")
    expect(a).not.toBe(b)
  })

  test("same workspace+host yields the same partition key", () => {
    expect(Browser.partitionKey("w", "localhost:3000")).toBe(
      Browser.partitionKey("w", "localhost:3000"),
    )
  })

  test("isLocalHost accepts loopback variants", () => {
    expect(Browser.isLocalHost("localhost")).toBe(true)
    expect(Browser.isLocalHost("127.0.0.1")).toBe(true)
    expect(Browser.isLocalHost("[::1]")).toBe(true)
  })

  test("isLocalHost rejects external hosts", () => {
    expect(Browser.isLocalHost("example.com")).toBe(false)
  })

  test("checkNavigation flags suspicious schemes", () => {
    const r = Browser.checkNavigation("javascript:alert(1)")
    expect(r.allowed).toBe(false)
  })
})
