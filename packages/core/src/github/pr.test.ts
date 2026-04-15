import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { codaBus } from "../event/bus"
import { type FetchLike, PrClient } from "./pr"

interface MockResponse {
  status?: number
  body?: unknown
  headers?: Record<string, string>
}

function mockFetch(handler: (url: string, init?: Parameters<FetchLike>[1]) => MockResponse): {
  fetch: FetchLike
  calls: { url: string; init?: Parameters<FetchLike>[1] }[]
} {
  const calls: { url: string; init?: Parameters<FetchLike>[1] }[] = []
  const fetch: FetchLike = (url, init) => {
    calls.push({ url, init })
    const r = handler(url, init)
    const status = r.status ?? 200
    const headers = r.headers ?? {}
    const json = r.body ?? null
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
      json: () => Promise.resolve(json),
      text: () => Promise.resolve(JSON.stringify(json)),
    })
  }
  return { fetch, calls }
}

beforeEach(() => codaBus.removeAll())
afterEach(() => codaBus.removeAll())

describe("PrClient.list", () => {
  test("defaults to state=open per_page=30", async () => {
    const m = mockFetch(() => ({
      body: [
        {
          number: 1,
          state: "open",
          title: "pr",
          user: { login: "alice" },
          head: { sha: "abcdef0" },
          base: { sha: "0000001" },
          merged_at: null,
        },
      ],
    }))
    const client = new PrClient({ fetch: m.fetch, token: "t" })
    const prs = await client.list({ owner: "o", repo: "r" })
    expect(prs[0]?.number).toBe(1)
    expect(m.calls[0]?.url).toContain("state=open")
    expect(m.calls[0]?.url).toContain("per_page=30")
  })

  test("limit clamps to 100", async () => {
    const m = mockFetch(() => ({ body: [] }))
    await new PrClient({ fetch: m.fetch, token: "t" }).list({
      owner: "o",
      repo: "r",
      limit: 999,
    })
    expect(m.calls[0]?.url).toContain("per_page=100")
  })
})

describe("PrClient.get", () => {
  const detail = {
    number: 7,
    state: "open",
    title: "fix bug",
    user: { login: "carol" },
    head: { sha: "deadbee" },
    base: { sha: "1234567" },
    merged_at: null,
  }

  test("returns view + caches by headSha", async () => {
    const events: number[] = []
    codaBus.on("Pr.Fetched", (e) => events.push(e.number))

    const responses: MockResponse[] = [
      { body: detail },
      { body: [{ filename: "a.ts", status: "modified", additions: 5, deletions: 2, patch: "p" }] },
    ]
    let i = 0
    const m = mockFetch(() => responses[i++] ?? { body: {} })
    const client = new PrClient({ fetch: m.fetch, token: "t" })
    const view = await client.get({ owner: "o", repo: "r", number: 7 })
    expect(view.title).toBe("fix bug")
    expect(view.files).toHaveLength(1)
    expect(events).toEqual([7])

    let now = 1_000_000
    let i2 = 0
    const m2 = mockFetch(
      () => [{ body: detail }, { body: [] }, { body: detail }][i2++] ?? { body: {} },
    )
    const c3 = new PrClient({ fetch: m2.fetch, token: "t", now: () => now })
    const v1 = await c3.get({ owner: "o", repo: "r", number: 7 })
    expect(v1.headSha).toBe("deadbee")
    expect(c3.cacheSize()).toBe(1)

    now += 30_000
    await c3.get({ owner: "o", repo: "r", number: 7 })
    expect(m2.calls.length).toBe(3)
  })

  test("submodule + too-large file preserved", async () => {
    let i = 0
    const responses: MockResponse[] = [
      { body: detail },
      {
        body: [
          { filename: "sub", status: "modified", additions: 0, deletions: 0, patch: null },
          {
            filename: "big.bin",
            status: "modified",
            additions: 1000,
            deletions: 0,
            patch: null,
            blob_url: "https://github.com/blob",
          },
        ],
      },
    ]
    const m = mockFetch(() => responses[i++] ?? { body: {} })
    const view = await new PrClient({ fetch: m.fetch, token: "t" }).get({
      owner: "o",
      repo: "r",
      number: 7,
    })
    expect(view.files[0]?.patch).toBe(null)
    expect(view.files[1]?.blobUrl).toBe("https://github.com/blob")
  })
})

describe("PrClient.review pre-flight", () => {
  test("blocks self-approval", async () => {
    let i = 0
    const detail = {
      number: 7,
      state: "open",
      title: "x",
      user: { login: "me" },
      head: { sha: "abc1234" },
      base: { sha: "def5678" },
      merged_at: null,
    }
    const m = mockFetch(() => [{ body: detail }, { body: [] }][i++] ?? { body: {} })
    const client = new PrClient({ fetch: m.fetch, token: "t", currentUser: "me" })
    await expect(
      client.review({ owner: "o", repo: "r", number: 7, kind: "APPROVE" }),
    ).rejects.toMatchObject({ code: "self_approval" })
  })

  test("blocks closed-PR approve", async () => {
    let i = 0
    const detail = {
      number: 7,
      state: "closed",
      title: "x",
      user: { login: "other" },
      head: { sha: "abc1234" },
      base: { sha: "def5678" },
      merged_at: null,
    }
    const m = mockFetch(() => [{ body: detail }, { body: [] }][i++] ?? { body: {} })
    const client = new PrClient({ fetch: m.fetch, token: "t", currentUser: "me" })
    await expect(
      client.review({ owner: "o", repo: "r", number: 7, kind: "APPROVE" }),
    ).rejects.toMatchObject({ code: "pr_closed" })
  })
})

describe("PrClient errors", () => {
  test("401 → unauthorized", async () => {
    const m = mockFetch(() => ({ status: 401, body: { message: "Bad creds" } }))
    const client = new PrClient({ fetch: m.fetch, token: "t" })
    await expect(client.list({ owner: "o", repo: "r" })).rejects.toMatchObject({
      code: "unauthorized",
    })
  })

  test("403 + x-ratelimit-remaining=0 → rate_limited with resetAt", async () => {
    const m = mockFetch(() => ({
      status: 403,
      body: { message: "rate limit" },
      headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1700000000" },
    }))
    const client = new PrClient({ fetch: m.fetch, token: "t" })
    await expect(client.list({ owner: "o", repo: "r" })).rejects.toMatchObject({
      code: "rate_limited",
      resetAt: 1_700_000_000,
    })
  })
})
