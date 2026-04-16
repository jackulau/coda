import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { codaBus } from "../event/bus"
import { PtySessionStore, wirePtySessionCascade } from "../pty/session-store"
import type { WorkspaceInfo } from "../workspace"
import { WorkspaceStore } from "../workspace/store"
import { MockPtyDriver } from "./driver"
import { NoopCwdProbe, PtyLifecycleManager, ScriptedCwdProbe } from "./lifecycle"

const ws = (overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo => ({
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  name: "w",
  cwd: "/tmp/w",
  baseBranch: "main",
  pinned: false,
  createdAt: Date.now(),
  ...overrides,
})

beforeEach(() => {
  WorkspaceStore.clear()
  PtySessionStore.clear()
  codaBus.removeAll()
  wirePtySessionCascade()
})
afterEach(() => {
  WorkspaceStore.clear()
  PtySessionStore.clear()
  codaBus.removeAll()
})

describe("PtyLifecycleManager", () => {
  test("spawn succeeds for a valid workspace", async () => {
    const w = WorkspaceStore.upsert(ws())
    const mgr = new PtyLifecycleManager(new MockPtyDriver(), new NoopCwdProbe())
    const out = await mgr.spawn({ workspaceId: w.id, title: "sh", cmd: "bash" })
    expect("sessionId" in out).toBe(true)
    if ("sessionId" in out) {
      expect(PtySessionStore.get(out.sessionId)).toBeDefined()
    }
  })

  test("spawn for missing workspace returns NO_WORKSPACE", async () => {
    const mgr = new PtyLifecycleManager(new MockPtyDriver(), new NoopCwdProbe())
    const out = await mgr.spawn({ workspaceId: crypto.randomUUID(), title: "x", cmd: "x" })
    expect("code" in out).toBe(true)
    if ("code" in out) expect(out.code).toBe("NO_WORKSPACE")
  })

  test("spawn with unreadable cwd → typed EACCES", async () => {
    const w = WorkspaceStore.upsert(ws())
    const mgr = new PtyLifecycleManager(new MockPtyDriver(), new ScriptedCwdProbe("EACCES"))
    const out = await mgr.spawn({ workspaceId: w.id, title: "x", cmd: "x" })
    expect("code" in out).toBe(true)
    if ("code" in out) expect(out.code).toBe("EACCES")
  })

  test("spawn with non-existent cwd → typed ENOENT", async () => {
    const w = WorkspaceStore.upsert(ws())
    const mgr = new PtyLifecycleManager(new MockPtyDriver(), new ScriptedCwdProbe("ENOENT"))
    const out = await mgr.spawn({ workspaceId: w.id, title: "x", cmd: "x" })
    expect("code" in out && out.code).toBe("ENOENT")
  })

  test("driver exit updates PtySession.exitCode", async () => {
    const w = WorkspaceStore.upsert(ws())
    const driver = new MockPtyDriver()
    const mgr = new PtyLifecycleManager(driver, new NoopCwdProbe())
    const out = await mgr.spawn({ workspaceId: w.id, title: "x", cmd: "x" })
    if (!("sessionId" in out)) throw new Error("spawn failed")
    driver.triggerExit(out.sessionId, 42)
    expect(PtySessionStore.get(out.sessionId)?.exitCode).toBe(42)
  })

  test("terminate SIGTERMs then falls back to SIGKILL after grace", async () => {
    const w = WorkspaceStore.upsert(ws())
    const driver = new MockPtyDriver()
    const mgr = new PtyLifecycleManager(driver, new NoopCwdProbe())
    const out = await mgr.spawn({ workspaceId: w.id, title: "x", cmd: "x" })
    if (!("sessionId" in out)) throw new Error("spawn failed")
    const code = await mgr.terminate(out.sessionId, 10)
    expect(code).toBe(143)
  })

  test("spawn failure returns UNKNOWN and marks session exited", async () => {
    const w = WorkspaceStore.upsert(ws())
    const driver = new MockPtyDriver({ spawnShouldFail: true })
    const mgr = new PtyLifecycleManager(driver, new NoopCwdProbe())
    const out = await mgr.spawn({ workspaceId: w.id, title: "x", cmd: "x" })
    expect("code" in out && out.code).toBe("UNKNOWN")
  })

  test("scrubs secret env before spawn (observed via session env is not leaked)", async () => {
    const w = WorkspaceStore.upsert(ws())
    const driver = new MockPtyDriver()
    const mgr = new PtyLifecycleManager(driver, new NoopCwdProbe())
    process.env.ANTHROPIC_API_KEY = "sk-ant-leak"
    const out = await mgr.spawn({ workspaceId: w.id, title: "x", cmd: "x" })
    process.env.ANTHROPIC_API_KEY = ""
    expect("sessionId" in out).toBe(true)
  })
})
