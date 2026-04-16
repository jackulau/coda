import { describe, expect, test } from "bun:test"
import { BoundedRequestLog, type NetworkRequestRecord, classifyRequest } from "./network"

const r = (o: Partial<NetworkRequestRecord> = {}): NetworkRequestRecord => ({
  id: "1",
  url: "https://a.com/",
  method: "GET",
  startedAt: 1000,
  ...o,
})

describe("classifyRequest", () => {
  test("404 → client-error", () => {
    expect(classifyRequest(r({ status: 404 }))).toEqual([
      expect.objectContaining({ kind: "client-error-404" }),
    ])
  })
  test("500 → server-error", () => {
    expect(classifyRequest(r({ status: 503 }))).toEqual([
      expect.objectContaining({ kind: "server-error-503" }),
    ])
  })
  test("failed → network-error", () => {
    expect(classifyRequest(r({ failed: true }))).toEqual([
      expect.objectContaining({ kind: "network-error" }),
    ])
  })
  test("aborted → aborted", () => {
    expect(classifyRequest(r({ aborted: true }))).toEqual([
      expect.objectContaining({ kind: "aborted" }),
    ])
  })
  test("http on https page → mixed-content", () => {
    expect(classifyRequest(r({ url: "http://insecure/", pageIsHttps: true }))).toEqual([
      expect.objectContaining({ kind: "mixed-content" }),
    ])
  })
  test("duplicate within 1 s flagged", () => {
    const prior = r({ id: "0", startedAt: 500 })
    const current = r({ id: "1", startedAt: 1200 })
    const issues = classifyRequest(current, [prior])
    expect(issues[0]?.kind).toBe("duplicate")
  })
  test("duplicate outside 1 s window → no issue", () => {
    const prior = r({ id: "0", startedAt: 0 })
    const current = r({ id: "1", startedAt: 2500 })
    expect(classifyRequest(current, [prior])).toEqual([])
  })
})

describe("BoundedRequestLog", () => {
  test("cap evicts oldest", () => {
    const log = new BoundedRequestLog(2)
    log.add(r({ id: "a" }))
    log.add(r({ id: "b" }))
    log.add(r({ id: "c" }))
    expect(log.size()).toBe(2)
    expect(log.list().map((x) => x.id)).toEqual(["b", "c"])
  })
})
