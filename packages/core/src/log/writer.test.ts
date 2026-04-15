import { describe, expect, test } from "bun:test"
import { LogWriter, MemorySink } from "./writer"

describe("LogWriter", () => {
  test("writes NDJSON one line per call", () => {
    const sink = new MemorySink()
    const log = new LogWriter({ sink, source: "test", now: () => 100 })
    log.info("hello", { user: "alice" })
    log.warn("watch out")
    expect(sink.current()).toHaveLength(2)
    const first = JSON.parse(sink.current()[0] ?? "{}")
    expect(first).toEqual({
      ts: 100,
      level: "info",
      source: "test",
      msg: "hello",
      data: { user: "alice" },
    })
  })

  test("redacts secret-shaped fields in data", () => {
    const sink = new MemorySink()
    const log = new LogWriter({ sink, source: "test" })
    log.error("auth failed", { token: "ghp_supersecret123abcdef" })
    const rec = JSON.parse(sink.current()[0] ?? "{}")
    expect(rec.data.token).toBe("<redacted>")
  })

  test("respects minLevel filter", () => {
    const sink = new MemorySink()
    const log = new LogWriter({ sink, source: "t", minLevel: "warn" })
    log.debug("ignored")
    log.info("ignored")
    log.warn("kept")
    log.error("kept")
    expect(sink.current()).toHaveLength(2)
  })
})

describe("MemorySink", () => {
  test("rotates when over maxLines", () => {
    const sink = new MemorySink(3)
    sink.write("a")
    sink.write("b")
    sink.write("c")
    sink.write("d")
    expect(sink.current()).toEqual(["d"])
    expect(sink.history()).toEqual([["a", "b", "c"]])
  })

  test("manual rotate moves current to history", () => {
    const sink = new MemorySink()
    sink.write("a")
    sink.rotate()
    expect(sink.current()).toEqual([])
    expect(sink.history()).toEqual([["a"]])
  })

  test("rotate on empty buffer is a no-op", () => {
    const sink = new MemorySink()
    sink.rotate()
    sink.rotate()
    expect(sink.history()).toEqual([])
  })
})
