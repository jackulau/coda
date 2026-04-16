import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { MockPtyDriver } from "../pty-lifecycle/driver"
import { type CwdProbe, PtyLifecycleManager } from "../pty-lifecycle/lifecycle"
import { WorkspaceInfo } from "../workspace/index"
import { WorkspaceStore } from "../workspace/store"
import { PtySessionStore } from "./session-store"

const WID = "00000000-0000-0000-0000-000000000101"

function seedWorkspace(cwd = "/tmp/feature-x"): WorkspaceInfo {
  const w = WorkspaceInfo.parse({
    id: WID,
    projectId: "00000000-0000-0000-0000-000000000100",
    name: "feature-x",
    cwd,
    baseBranch: "main",
    pinned: false,
    createdAt: 1000,
  })
  WorkspaceStore.upsert(w)
  return w
}

function probe(map: Record<string, "ok" | "ENOENT" | "EACCES" | "ENOTDIR">): CwdProbe {
  return { access: async (cwd) => map[cwd] ?? "ENOENT" }
}

beforeEach(() => {
  WorkspaceStore.clear()
  PtySessionStore.clear()
})

afterEach(() => {
  WorkspaceStore.clear()
  PtySessionStore.clear()
})

describe("PtyLifecycleManager.spawn", () => {
  test("spawn returns a sessionId and records PtySession", async () => {
    seedWorkspace("/tmp/ok")
    const mgr = new PtyLifecycleManager(new MockPtyDriver(), probe({ "/tmp/ok": "ok" }))
    const res = await mgr.spawn({ workspaceId: WID, title: "bash", cmd: "bash" })
    if ("code" in res) throw new Error(`expected success, got ${res.code}`)
    expect(res.sessionId).toBeDefined()
    expect(PtySessionStore.get(res.sessionId)?.workspaceId).toBe(WID)
  })

  test("spawn refuses when workspace missing → NO_WORKSPACE", async () => {
    const mgr = new PtyLifecycleManager(new MockPtyDriver(), probe({ "/tmp/ok": "ok" }))
    const res = await mgr.spawn({
      workspaceId: "00000000-0000-0000-0000-000000000999",
      title: "t",
      cmd: "bash",
    })
    expect("code" in res && res.code).toBe("NO_WORKSPACE")
  })

  test("spawn refuses when cwd missing → ENOENT", async () => {
    seedWorkspace("/tmp/nope")
    const mgr = new PtyLifecycleManager(new MockPtyDriver(), probe({ "/tmp/nope": "ENOENT" }))
    const res = await mgr.spawn({ workspaceId: WID, title: "t", cmd: "bash" })
    expect("code" in res && res.code).toBe("ENOENT")
  })

  test("spawn refuses when cwd not a directory → ENOTDIR", async () => {
    seedWorkspace("/tmp/afile")
    const mgr = new PtyLifecycleManager(new MockPtyDriver(), probe({ "/tmp/afile": "ENOTDIR" }))
    const res = await mgr.spawn({ workspaceId: WID, title: "t", cmd: "bash" })
    expect("code" in res && res.code).toBe("ENOTDIR")
  })

  test("spawn succeeds even with secret env (scrubbed internally before spawn)", async () => {
    seedWorkspace("/tmp/scrub")
    const mgr = new PtyLifecycleManager(new MockPtyDriver(), probe({ "/tmp/scrub": "ok" }))
    const res = await mgr.spawn({
      workspaceId: WID,
      title: "t",
      cmd: "bash",
      env: { GITHUB_TOKEN: "secret", FOO: "bar" },
    })
    expect("sessionId" in res).toBe(true)
  })
})
