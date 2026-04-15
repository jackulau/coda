import { describe, expect, test } from "bun:test"
import { type CodaEvents, EventBus } from "./bus"

describe("EventBus", () => {
  test("emits to subscribed listeners only", () => {
    const bus = new EventBus<CodaEvents>()
    const calls: string[] = []
    bus.on("Project.Updated", (v) => calls.push(`a:${v.id}`))
    bus.on("Project.Updated", (v) => calls.push(`b:${v.id}`))
    bus.on("Workspace.Created", () => calls.push("never"))
    bus.emit("Project.Updated", { id: "p1" })
    expect(calls).toEqual(["a:p1", "b:p1"])
  })

  test("off() unsubscribes", () => {
    const bus = new EventBus<CodaEvents>()
    const calls: string[] = []
    const off = bus.on("Workspace.Updated", (v) => calls.push(v.id))
    bus.emit("Workspace.Updated", { id: "w1" })
    off()
    bus.emit("Workspace.Updated", { id: "w2" })
    expect(calls).toEqual(["w1"])
  })

  test("once() fires exactly one time", () => {
    const bus = new EventBus<CodaEvents>()
    const calls: number[] = []
    bus.once("Workspace.Created", (v) => calls.push(1))
    bus.emit("Workspace.Created", { id: "w1", projectId: "p1" })
    bus.emit("Workspace.Created", { id: "w2", projectId: "p1" })
    expect(calls).toEqual([1])
  })

  test("listener throwing does not break sibling listeners", () => {
    const bus = new EventBus<CodaEvents>()
    const calls: string[] = []
    bus.on("Workspace.Deleted", () => {
      throw new Error("boom")
    })
    bus.on("Workspace.Deleted", (v) => calls.push(v.id))
    bus.emit("Workspace.Deleted", { id: "w1" })
    expect(calls).toEqual(["w1"])
  })

  test("listenerCount reflects current subs", () => {
    const bus = new EventBus<CodaEvents>()
    expect(bus.listenerCount("Project.Updated")).toBe(0)
    const off = bus.on("Project.Updated", () => undefined)
    expect(bus.listenerCount("Project.Updated")).toBe(1)
    off()
    expect(bus.listenerCount("Project.Updated")).toBe(0)
  })

  test("removeAll clears every subscription", () => {
    const bus = new EventBus<CodaEvents>()
    bus.on("Project.Updated", () => undefined)
    bus.on("Workspace.Created", () => undefined)
    bus.removeAll()
    expect(bus.listenerCount("Project.Updated")).toBe(0)
    expect(bus.listenerCount("Workspace.Created")).toBe(0)
  })
})
