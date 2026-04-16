import { describe, expect, test } from "bun:test"
import { type ShutdownStage, runShutdown, topologicalOrder } from "./shutdown"

const noop = { run: () => undefined }

describe("topologicalOrder", () => {
  test("priority-based when no deps", () => {
    const stages: ShutdownStage[] = [
      { name: "a", priority: 3, ...noop },
      { name: "b", priority: 1, ...noop },
      { name: "c", priority: 2, ...noop },
    ]
    expect(topologicalOrder(stages)).toEqual(["b", "c", "a"])
  })

  test("dependencies are visited first", () => {
    const stages: ShutdownStage[] = [
      { name: "db", priority: 5, dependsOn: ["sidecar"], ...noop },
      { name: "sidecar", priority: 10, ...noop },
    ]
    const out = topologicalOrder(stages)
    expect(out.indexOf("sidecar")).toBeLessThan(out.indexOf("db"))
  })

  test("cycle throws", () => {
    const stages: ShutdownStage[] = [
      { name: "a", priority: 1, dependsOn: ["b"], ...noop },
      { name: "b", priority: 2, dependsOn: ["a"], ...noop },
    ]
    expect(() => topologicalOrder(stages)).toThrow(/cycle/)
  })

  test("unknown dep throws", () => {
    const stages: ShutdownStage[] = [{ name: "a", priority: 1, dependsOn: ["ghost"], ...noop }]
    expect(() => topologicalOrder(stages)).toThrow(/unknown shutdown stage/)
  })
})

describe("runShutdown", () => {
  test("runs in topological order", async () => {
    const trace: string[] = []
    const stages: ShutdownStage[] = [
      { name: "a", priority: 1, run: () => void trace.push("a") },
      {
        name: "b",
        priority: 2,
        dependsOn: ["a"],
        run: () => void trace.push("b"),
      },
    ]
    const r = await runShutdown(stages)
    expect(r.order).toEqual(["a", "b"])
    expect(r.errors).toEqual([])
    expect(trace).toEqual(["a", "b"])
  })

  test("errors collected, subsequent stages still run", async () => {
    const trace: string[] = []
    const stages: ShutdownStage[] = [
      {
        name: "boom",
        priority: 1,
        run: () => {
          throw new Error("x")
        },
      },
      { name: "cleanup", priority: 2, run: () => void trace.push("cleanup") },
    ]
    const r = await runShutdown(stages)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]?.stage).toBe("boom")
    expect(trace).toEqual(["cleanup"])
  })
})
