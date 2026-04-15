import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { codaBus } from "../event/bus"
import { WatchdogCircuit } from "./watchdog"

beforeEach(() => codaBus.removeAll())
afterEach(() => codaBus.removeAll())

describe("WatchdogCircuit", () => {
  test("first crash returns base delay 200ms attempt=1", () => {
    const w = new WatchdogCircuit()
    const r = w.recordCrash("test")
    expect(r).toEqual({ attempt: 1, delayMs: 200 })
  })

  test("backoff doubles each crash", () => {
    let now = 0
    const w = new WatchdogCircuit({ now: () => now })
    const a = w.recordCrash("a") as { attempt: number; delayMs: number }
    now += 1000
    const b = w.recordCrash("b") as { attempt: number; delayMs: number }
    now += 1000
    const c = w.recordCrash("c") as { attempt: number; delayMs: number }
    expect(a.delayMs).toBe(200)
    expect(b.delayMs).toBe(400)
    expect(c.delayMs).toBe(800)
  })

  test("backoff caps at maxDelayMs (30s)", () => {
    let now = 0
    const w = new WatchdogCircuit({ now: () => now, threshold: 100 })
    let last = 0
    for (let i = 1; i <= 10; i++) {
      now += 1000
      const r = w.recordCrash(`#${i}`) as { delayMs: number }
      last = r.delayMs
    }
    expect(last).toBe(30_000)
  })

  test("circuit opens at threshold within window", () => {
    let now = 0
    const w = new WatchdogCircuit({ now: () => now, threshold: 5, windowMs: 60_000 })
    for (let i = 0; i < 4; i++) {
      now += 1_000
      expect(w.recordCrash(`#${i}`)).not.toBe("circuit-open")
    }
    now += 1_000
    expect(w.recordCrash("trip")).toBe("circuit-open")
    expect(w.currentState()).toBe("open")
  })

  test("reset clears state and history", () => {
    const w = new WatchdogCircuit({ threshold: 5 })
    for (let i = 0; i < 5; i++) w.recordCrash(`#${i}`)
    w.reset()
    expect(w.currentState()).toBe("healthy")
    expect(w.crashesInWindow()).toBe(0)
  })

  test("recordHealthy resets consecutive but preserves history", () => {
    let now = 0
    const w = new WatchdogCircuit({ now: () => now, threshold: 5, windowMs: 60_000 })
    w.recordCrash("a")
    w.recordHealthy()
    now += 1000
    const next = w.recordCrash("b") as { delayMs: number }
    expect(next.delayMs).toBe(200)
  })

  test("emits Sidecar.Crashed with attempt counter", () => {
    const events: number[] = []
    codaBus.on("Sidecar.Crashed", (e) => events.push(e.restartAttempt))
    const w = new WatchdogCircuit({ threshold: 100 })
    w.recordCrash("a")
    w.recordCrash("b")
    expect(events).toEqual([1, 2])
  })

  test("emits restartAttempt=-1 when circuit opens", () => {
    const events: number[] = []
    codaBus.on("Sidecar.Crashed", (e) => events.push(e.restartAttempt))
    const w = new WatchdogCircuit({ threshold: 2 })
    w.recordCrash("a")
    w.recordCrash("b")
    expect(events).toEqual([1, -1])
  })
})
