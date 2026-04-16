import { describe, expect, test } from "bun:test"
import { type FileRepository, saveFileTool } from "./save-file"
import { McpRegistry } from "./tools"

function memRepo(): FileRepository & { files: Map<string, { content: string; rev: number }> } {
  const files = new Map<string, { content: string; rev: number }>()
  return {
    files,
    exists(p) {
      return files.has(p)
    },
    revisionOf(p) {
      return files.get(p)?.rev ?? null
    },
    write(p, c) {
      const cur = files.get(p)?.rev ?? 0
      const rev = cur + 1
      files.set(p, { content: c, rev })
      return { bytesWritten: c.length, newRevision: rev }
    },
  }
}

describe("saveFileTool", () => {
  test("writes content and returns new revision", async () => {
    const repo = memRepo()
    const reg = new McpRegistry()
    reg.register(saveFileTool(repo, ["/work"]))
    const out = await reg.dispatch(
      {
        name: "coda.saveFile",
        arguments: { path: "/work/a.ts", content: "hello" },
        callId: crypto.randomUUID(),
      },
      { workspaceId: "w", workspaceCwd: "/work", userRequestedAt: 0 },
    )
    expect(out.ok).toBe(true)
    if (out.ok) {
      const r = out.result as { bytesWritten: number; newRevision: number }
      expect(r.bytesWritten).toBe(5)
      expect(r.newRevision).toBe(1)
    }
  })

  test("rejects path outside allowlist", async () => {
    const repo = memRepo()
    const reg = new McpRegistry()
    reg.register(saveFileTool(repo, ["/work"]))
    const out = await reg.dispatch(
      {
        name: "coda.saveFile",
        arguments: { path: "/etc/passwd", content: "x" },
        callId: crypto.randomUUID(),
      },
      { workspaceId: "w", workspaceCwd: "/work", userRequestedAt: 0 },
    )
    expect(out.ok).toBe(false)
  })

  test("rejects when no focused workspace", async () => {
    const repo = memRepo()
    const reg = new McpRegistry()
    reg.register(saveFileTool(repo, ["/work"]))
    const out = await reg.dispatch(
      {
        name: "coda.saveFile",
        arguments: { path: "/work/x", content: "x" },
        callId: crypto.randomUUID(),
      },
      { workspaceId: null, workspaceCwd: null, userRequestedAt: 0 },
    )
    expect(out.ok).toBe(false)
  })

  test("ifMatchRevision mismatch fails with handler-threw", async () => {
    const repo = memRepo()
    repo.write("/work/f", "initial")
    const reg = new McpRegistry()
    reg.register(saveFileTool(repo, ["/work"]))
    const out = await reg.dispatch(
      {
        name: "coda.saveFile",
        arguments: { path: "/work/f", content: "x", ifMatchRevision: 99 },
        callId: crypto.randomUUID(),
      },
      { workspaceId: "w", workspaceCwd: "/work", userRequestedAt: 0 },
    )
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe("handler-threw")
  })
})
