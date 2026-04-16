import { describe, expect, test } from "bun:test"
import { type SupervisedProcess, Supervisor } from "./supervisor"

function makeProc(plan: Array<"ok" | "fail">): {
  proc: SupervisedProcess
  starts: number
} {
  let starts = 0
  let i = 0
  const proc: SupervisedProcess = {
    name: "test",
    start: async () => {
      starts++
    },
    ping: async () => {
      const v = plan[i++] ?? "ok"
      return v === "ok"
    },
  }
  return {
    proc,
    get starts() {
      return starts
    },
  } as { proc: SupervisedProcess; starts: number }
}

describe("Supervisor", () => {
  test("healthy tick records healthy", async () => {
    let i = 0
    const proc: SupervisedProcess = {
      name: "t",
      start: async () => undefined,
      ping: async () => {
        i++
        return true
      },
    }
    const sup = new Supervisor(proc)
    await sup.startOnce()
    const ev = await sup.tick()
    expect(ev?.kind).toBe("healthy")
    expect(sup.circuitState()).toBe("healthy")
  })

  test("failed ping triggers crash + restart with backoff", async () => {
    const plan: Array<"ok" | "fail"> = ["fail"]
    let i = 0
    let restarts = 0
    const proc: SupervisedProcess = {
      name: "t",
      start: async () => {
        restarts++
      },
      ping: async () => plan[i++] === "ok",
    }
    const sup = new Supervisor(proc)
    await sup.startOnce()
    const ev = await sup.tick()
    expect(ev?.kind).toBe("crash")
    expect(restarts).toBe(2)
  })

  test("N consecutive crashes open the circuit", async () => {
    let i = 0
    let now = 0
    const proc: SupervisedProcess = {
      name: "t",
      start: async () => undefined,
      ping: async () => {
        i++
        return false
      },
    }
    const sup = new Supervisor(proc, { threshold: 3, windowMs: 60_000, now: () => now })
    await sup.startOnce()
    await sup.tick()
    now += 1000
    await sup.tick()
    now += 1000
    const ev = await sup.tick()
    expect(ev?.kind).toBe("circuit-open")
    expect(sup.circuitState()).toBe("open")
  })

  test("history returns every event in order", async () => {
    let flip = true
    const proc: SupervisedProcess = {
      name: "t",
      start: async () => undefined,
      ping: async () => {
        const v = flip
        flip = !flip
        return v
      },
    }
    const sup = new Supervisor(proc)
    await sup.startOnce()
    await sup.tick()
    await sup.tick()
    const kinds = sup.history().map((e) => e.kind)
    expect(kinds).toEqual(["started", "healthy", "crash"])
  })
})
