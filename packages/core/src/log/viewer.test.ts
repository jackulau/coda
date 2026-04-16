import { describe, expect, test } from "bun:test"
import { parseLines, queryLogs } from "./viewer"
import type { LogRecord } from "./writer"

const rec = (overrides: Partial<LogRecord>): LogRecord => ({
  ts: 0,
  level: "info",
  source: "test",
  msg: "ok",
  ...overrides,
})

describe("parseLines", () => {
  test("parses NDJSON log records, skipping malformed", () => {
    const out = parseLines([
      JSON.stringify(rec({ ts: 1, msg: "a" })),
      "{not json",
      JSON.stringify(rec({ ts: 2, msg: "b" })),
      "",
      JSON.stringify({ not: "a log record" }),
    ])
    expect(out).toHaveLength(2)
    expect(out.map((r) => r.msg)).toEqual(["a", "b"])
  })
})

describe("queryLogs", () => {
  const records: LogRecord[] = [
    rec({ ts: 100, level: "info", source: "app", msg: "started" }),
    rec({ ts: 200, level: "warn", source: "app", msg: "slow disk" }),
    rec({ ts: 300, level: "error", source: "sidecar", msg: "fetch failed" }),
    rec({ ts: 400, level: "debug", source: "app", msg: "tick" }),
  ]

  test("levels filter", () => {
    expect(queryLogs(records, { levels: ["error"] }).map((r) => r.msg)).toEqual(["fetch failed"])
  })

  test("sources filter", () => {
    expect(queryLogs(records, { sources: ["sidecar"] })).toHaveLength(1)
  })

  test("time range filter", () => {
    const out = queryLogs(records, { since: 150, until: 350 }).map((r) => r.msg)
    expect(out).toEqual(["slow disk", "fetch failed"])
  })

  test("text search (case-insensitive)", () => {
    const out = queryLogs(records, { text: "SLOW" }).map((r) => r.msg)
    expect(out).toEqual(["slow disk"])
  })

  test("limit keeps last N by ts", () => {
    const out = queryLogs(records, { limit: 2 }).map((r) => r.msg)
    expect(out).toEqual(["fetch failed", "tick"])
  })

  test("result sorted by ts ascending", () => {
    const shuffled = [records[2], records[0], records[3], records[1]].filter(
      (r): r is LogRecord => r !== undefined,
    )
    expect(queryLogs(shuffled, {}).map((r) => r.ts)).toEqual([100, 200, 300, 400])
  })
})
