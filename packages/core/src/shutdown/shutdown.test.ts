import { describe, expect, test } from "bun:test"
import { runShutdown, type ShutdownStage, topologicalOrder } from "../lifecycle/shutdown"

describe("graceful shutdown (J8)", () => {
  test("topologicalOrder respects dependsOn", () => {
    const stages: ShutdownStage[] = [
      { name: "db", priority: 10, dependsOn: ["pty"], run: () => {} },
      { name: "pty", priority: 5, run: () => {} },
    ]
    const order = topologicalOrder(stages)
    expect(order.indexOf("pty")).toBeLessThan(order.indexOf("db"))
  })

  test("topologicalOrder breaks ties by priority", () => {
    const stages: ShutdownStage[] = [
      { name: "b", priority: 10, run: () => {} },
      { name: "a", priority: 5, run: () => {} },
    ]
    expect(topologicalOrder(stages)).toEqual(["a", "b"])
  })

  test("runShutdown runs every stage in order", async () => {
    const seen: string[] = []
    const stages: ShutdownStage[] = [
      { name: "a", priority: 1, run: () => { seen.push("a") } },
      { name: "b", priority: 2, run: () => { seen.push("b") } },
      { name: "c", priority: 3, run: () => { seen.push("c") } },
    ]
    const result = await runShutdown(stages)
    expect(seen).toEqual(["a", "b", "c"])
    expect(result.errors).toEqual([])
  })

  test("runShutdown collects errors but keeps running other stages", async () => {
    const seen: string[] = []
    const stages: ShutdownStage[] = [
      { name: "a", priority: 1, run: () => { seen.push("a"); throw new Error("boom") } },
      { name: "b", priority: 2, run: () => { seen.push("b") } },
    ]
    const result = await runShutdown(stages)
    expect(seen).toEqual(["a", "b"])
    expect(result.errors.length).toBe(1)
    expect(result.errors[0]).toMatchObject({ stage: "a", message: "boom" })
  })

  test("unknown stage reference throws during ordering", () => {
    expect(() =>
      topologicalOrder([{ name: "a", priority: 1, dependsOn: ["missing"], run: () => {} }]),
    ).toThrow(/unknown shutdown stage/)
  })

  test("cycles throw during ordering", () => {
    const stages: ShutdownStage[] = [
      { name: "a", priority: 1, dependsOn: ["b"], run: () => {} },
      { name: "b", priority: 2, dependsOn: ["a"], run: () => {} },
    ]
    expect(() => topologicalOrder(stages)).toThrow(/cycle/)
  })
})
