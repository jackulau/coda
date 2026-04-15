import { describe, expect, test } from "bun:test"
import { classifyGitHubError } from "./error"

describe("classifyGitHubError", () => {
  test("401 → unauthorized", () => {
    const e = classifyGitHubError({ status: 401, body: { message: "Bad creds" } })
    expect(e.code).toBe("unauthorized")
    expect(e.retryable).toBe(false)
  })

  test("403 with x-ratelimit-remaining=0 → rate_limited with resetAt", () => {
    const e = classifyGitHubError({
      status: 403,
      body: { message: "rate limit exceeded" },
      headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1700000000" },
    })
    expect(e.code).toBe("rate_limited")
    expect(e.resetAt).toBe(1_700_000_000)
    expect(e.retryable).toBe(true)
  })

  test("403 without rate-limit hint → unauthorized", () => {
    const e = classifyGitHubError({ status: 403, body: { message: "forbidden" } })
    expect(e.code).toBe("unauthorized")
  })

  test("404 with resourceFound=false → repo_inaccessible", () => {
    const e = classifyGitHubError({ status: 404, resourceFound: false })
    expect(e.code).toBe("repo_inaccessible")
  })

  test("404 with resourceFound undefined → not_found", () => {
    const e = classifyGitHubError({ status: 404 })
    expect(e.code).toBe("not_found")
  })

  test("422 with 'closed' message → pr_closed", () => {
    const e = classifyGitHubError({ status: 422, body: { message: "PR closed" } })
    expect(e.code).toBe("pr_closed")
  })

  test("422 generic → stale_position", () => {
    const e = classifyGitHubError({ status: 422, body: { message: "validation" } })
    expect(e.code).toBe("stale_position")
    expect(e.retryable).toBe(true)
  })

  test("409 → pr_closed", () => {
    const e = classifyGitHubError({ status: 409 })
    expect(e.code).toBe("pr_closed")
  })

  test("500/502/503 → network with retryable", () => {
    expect(classifyGitHubError({ status: 500 }).code).toBe("network")
    expect(classifyGitHubError({ status: 503 }).retryable).toBe(true)
  })
})
