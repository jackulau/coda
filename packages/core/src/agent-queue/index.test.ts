import { describe, expect, test } from "bun:test"
import { AgentQueue } from "./index"

function makeQueue() {
  let now = 1000
  let counter = 0
  const q = new AgentQueue({
    now: () => now,
    id: () => `id-${++counter}`,
  })
  return {
    q,
    tick(ms: number) {
      now += ms
    },
  }
}

describe("AgentQueue.enqueue", () => {
  test("appends in FIFO order", () => {
    const { q } = makeQueue()
    q.enqueue("first")
    q.enqueue("second")
    q.enqueue("third")
    expect(q.list().map((m) => m.text)).toEqual(["first", "second", "third"])
  })

  test("empty text is dropped (returns null)", () => {
    const { q } = makeQueue()
    expect(q.enqueue("")).toBe(null)
    expect(q.size()).toBe(0)
  })

  test("preserves text exactly (no trim, no newline injection)", () => {
    const { q } = makeQueue()
    q.enqueue("  with spaces  \n")
    expect(q.list()[0]?.text).toBe("  with spaces  \n")
  })

  test("stamps enqueuedAt from clock", () => {
    const { q, tick } = makeQueue()
    q.enqueue("a")
    tick(500)
    q.enqueue("b")
    const items = q.list()
    expect(items[0]?.enqueuedAt).toBe(1000)
    expect(items[1]?.enqueuedAt).toBe(1500)
  })

  test("notifies subscribers", () => {
    const { q } = makeQueue()
    let calls = 0
    q.subscribe(() => {
      calls++
    })
    q.enqueue("a")
    q.enqueue("b")
    expect(calls).toBe(2)
  })
})

describe("AgentQueue.cancel", () => {
  test("removes pending message", () => {
    const { q } = makeQueue()
    const a = q.enqueue("a")
    q.enqueue("b")
    expect(q.cancel(a?.id ?? "")).toBe(true)
    expect(q.list().map((m) => m.text)).toEqual(["b"])
  })

  test("returns false for unknown id", () => {
    const { q } = makeQueue()
    expect(q.cancel("missing")).toBe(false)
  })

  test("notifies subscribers", () => {
    const { q } = makeQueue()
    const a = q.enqueue("a")
    let calls = 0
    q.subscribe(() => {
      calls++
    })
    q.cancel(a?.id ?? "")
    expect(calls).toBe(1)
  })
})

describe("AgentQueue.edit", () => {
  test("replaces text", () => {
    const { q } = makeQueue()
    const a = q.enqueue("draft")
    expect(q.edit(a?.id ?? "", "final")).toBe(true)
    expect(q.list()[0]?.text).toBe("final")
  })

  test("returns false for unknown id", () => {
    const { q } = makeQueue()
    expect(q.edit("missing", "x")).toBe(false)
  })
})

describe("AgentQueue.drain", () => {
  test("dispatches head when not busy", async () => {
    const { q } = makeQueue()
    q.enqueue("hello")
    q.enqueue("world")
    const sent: string[] = []
    const out = await q.drain((t) => {
      sent.push(t)
    })
    expect(out?.text).toBe("hello")
    expect(sent).toEqual(["hello"])
    expect(q.size()).toBe(1)
    expect(q.busy()).toBe(true)
  })

  test("no-op when busy", async () => {
    const { q } = makeQueue()
    q.enqueue("a")
    q.setBusy(true)
    const sent: string[] = []
    const out = await q.drain((t) => {
      sent.push(t)
    })
    expect(out).toBe(null)
    expect(sent).toEqual([])
    expect(q.size()).toBe(1)
  })

  test("no-op when empty", async () => {
    const { q } = makeQueue()
    const sent: string[] = []
    const out = await q.drain((t) => {
      sent.push(t)
    })
    expect(out).toBe(null)
    expect(sent).toEqual([])
  })

  test("strict FIFO across drain cycles", async () => {
    const { q } = makeQueue()
    q.enqueue("one")
    q.enqueue("two")
    q.enqueue("three")
    const sent: string[] = []
    const send = (t: string) => {
      sent.push(t)
    }

    await q.drain(send) // sends "one", busy=true
    q.setBusy(false)
    await q.drain(send) // sends "two"
    q.setBusy(false)
    await q.drain(send) // sends "three"
    expect(sent).toEqual(["one", "two", "three"])
    expect(q.size()).toBe(0)
  })

  test("requeues at head on send failure (no drops)", async () => {
    const { q } = makeQueue()
    q.enqueue("a")
    q.enqueue("b")

    let threw = false
    try {
      await q.drain(() => {
        throw new Error("pty closed")
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
    expect(q.size()).toBe(2)
    expect(q.list().map((m) => m.text)).toEqual(["a", "b"])
    expect(q.busy()).toBe(false)
  })

  test("does not double-dispatch from concurrent drain calls", async () => {
    const { q } = makeQueue()
    q.enqueue("a")
    q.enqueue("b")
    const sent: string[] = []
    const slow = (t: string) =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          sent.push(t)
          resolve()
        }, 5),
      )
    const [m1, m2] = await Promise.all([q.drain(slow), q.drain(slow)])
    expect(sent).toEqual(["a"])
    expect(m1?.text).toBe("a")
    expect(m2).toBe(null)
    expect(q.size()).toBe(1)
  })
})

describe("AgentQueue.setBusy", () => {
  test("notifies on change", () => {
    const { q } = makeQueue()
    let calls = 0
    q.subscribe(() => {
      calls++
    })
    q.setBusy(true)
    q.setBusy(true) // no-op
    q.setBusy(false)
    expect(calls).toBe(2)
  })
})

describe("AgentQueue.clear", () => {
  test("removes all pending and notifies", () => {
    const { q } = makeQueue()
    q.enqueue("a")
    q.enqueue("b")
    let calls = 0
    q.subscribe(() => {
      calls++
    })
    q.clear()
    expect(q.size()).toBe(0)
    expect(calls).toBe(1)
  })

  test("no-op when already empty", () => {
    const { q } = makeQueue()
    let calls = 0
    q.subscribe(() => {
      calls++
    })
    q.clear()
    expect(calls).toBe(0)
  })
})

describe("AgentQueue.subscribe", () => {
  test("unsubscribe stops notifications", () => {
    const { q } = makeQueue()
    let calls = 0
    const off = q.subscribe(() => {
      calls++
    })
    q.enqueue("a")
    off()
    q.enqueue("b")
    expect(calls).toBe(1)
  })
})
