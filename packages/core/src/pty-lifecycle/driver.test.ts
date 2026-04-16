import { describe, expect, test } from "bun:test"
import { MockPtyDriver } from "./driver"

describe("MockPtyDriver", () => {
  test("spawn + write emits echo data to listeners", async () => {
    const d = new MockPtyDriver()
    const received: string[] = []
    await d.spawn({ id: "s1", cwd: "/", cmd: "sh" })
    d.onData("s1", (c) => received.push(c))
    d.write("s1", "hello")
    expect(received).toEqual(["echo:hello"])
    expect(d.state("s1")).toBe("running")
  })

  test("kill SIGTERM fires exit listeners with 143", async () => {
    const d = new MockPtyDriver()
    const exits: number[] = []
    await d.spawn({ id: "s1", cwd: "/", cmd: "sh" })
    d.onExit("s1", (c) => exits.push(c))
    const code = await d.kill("s1")
    expect(code).toBe(143)
    expect(exits).toEqual([143])
    expect(d.state("s1")).toBe("exited")
  })

  test("kill SIGKILL returns 137", async () => {
    const d = new MockPtyDriver()
    await d.spawn({ id: "s1", cwd: "/", cmd: "sh" })
    expect(await d.kill("s1", "SIGKILL")).toBe(137)
  })

  test("double spawn same id throws", async () => {
    const d = new MockPtyDriver()
    await d.spawn({ id: "s1", cwd: "/", cmd: "sh" })
    await expect(d.spawn({ id: "s1", cwd: "/", cmd: "sh" })).rejects.toThrow(/already exists/)
  })

  test("spawnShouldFail sets state=failed", async () => {
    const d = new MockPtyDriver({ spawnShouldFail: true })
    await expect(d.spawn({ id: "s1", cwd: "/", cmd: "sh" })).rejects.toThrow()
    expect(d.state("s1")).toBe("failed")
  })

  test("pushOutput emits to data listeners", async () => {
    const d = new MockPtyDriver()
    await d.spawn({ id: "s1", cwd: "/", cmd: "sh" })
    const received: string[] = []
    d.onData("s1", (c) => received.push(c))
    d.pushOutput("s1", "custom")
    expect(received).toEqual(["custom"])
  })

  test("enospc simulated → write triggers exit 28", async () => {
    const d = new MockPtyDriver()
    await d.spawn({ id: "s1", cwd: "/", cmd: "sh" })
    d.setEnospc("s1", true)
    const exits: number[] = []
    d.onExit("s1", (c) => exits.push(c))
    d.write("s1", "x")
    expect(exits).toEqual([28])
  })
})
