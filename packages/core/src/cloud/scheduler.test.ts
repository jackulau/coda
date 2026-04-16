import { describe, expect, test } from "bun:test"
import { type CloudJob, nextRunnable, pickRegion, transitionJob } from "./scheduler"

const job = (overrides: Partial<CloudJob> = {}): CloudJob => ({
  id: "j",
  workspaceId: "w",
  command: "run",
  priority: 0,
  status: "queued",
  createdAt: 0,
  startedAt: null,
  finishedAt: null,
  region: "us",
  cost: 0,
  ...overrides,
})

describe("nextRunnable", () => {
  test("respects maxConcurrent", () => {
    const pending = [
      job({ id: "a", status: "running" }),
      job({ id: "b", status: "running" }),
      job({ id: "c", status: "queued" }),
    ]
    expect(nextRunnable(pending, { maxConcurrent: 2, maxPerWorkspace: 1 }, 0)).toBeNull()
  })

  test("picks highest priority queued, then oldest", () => {
    const pending = [
      job({ id: "a", createdAt: 2, priority: 1 }),
      job({ id: "b", createdAt: 1, priority: 5 }),
      job({ id: "c", createdAt: 0, priority: 5 }),
    ]
    expect(nextRunnable(pending, { maxConcurrent: 5, maxPerWorkspace: 5 }, 0)?.id).toBe("c")
  })

  test("enforces per-workspace cap", () => {
    const pending = [
      job({ id: "a", workspaceId: "w1", status: "running" }),
      job({ id: "b", workspaceId: "w1", status: "queued" }),
      job({ id: "c", workspaceId: "w2", status: "queued" }),
    ]
    expect(nextRunnable(pending, { maxConcurrent: 5, maxPerWorkspace: 1 }, 0)?.id).toBe("c")
  })
})

describe("transitionJob", () => {
  test("queued → provisioning → running → finished", () => {
    const t = transitionJob(job(), { kind: "provision", at: 1 })
    expect(t.status).toBe("provisioning")
    const u = transitionJob(t, { kind: "start", at: 2 })
    expect(u.status).toBe("running")
    const v = transitionJob(u, { kind: "finish", at: 3, cost: 0.5 })
    expect(v.status).toBe("finished")
    expect(v.cost).toBe(0.5)
  })

  test("invalid transitions throw", () => {
    expect(() => transitionJob(job({ status: "running" }), { kind: "provision", at: 1 })).toThrow()
  })

  test("fail/cancel always succeed", () => {
    const f = transitionJob(job({ status: "running" }), {
      kind: "fail",
      at: 1,
      reason: "oom",
    })
    expect(f.status).toBe("failed")
    const c = transitionJob(job(), { kind: "cancel", at: 1 })
    expect(c.status).toBe("cancelled")
  })
})

describe("pickRegion", () => {
  test("picks lowest rtt+load", () => {
    expect(
      pickRegion({
        "us-east": { rttMs: 50, load: 0.1 },
        "eu-west": { rttMs: 30, load: 0.5 },
      }),
    ).toBe("us-east")
  })

  test("empty → empty string", () => {
    expect(pickRegion({})).toBe("")
  })
})
