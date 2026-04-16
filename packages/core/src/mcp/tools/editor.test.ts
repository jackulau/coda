import { describe, expect, test } from "bun:test"
import { type FileRepository, saveFileTool } from "../save-file"
import type { ToolContext } from "../tools"

const CTX: ToolContext = { workspaceId: null, workspaceCwd: null, userRequestedAt: 0 }

class MemRepo implements FileRepository {
  private files = new Map<string, { content: string; revision: number }>()
  exists(path: string): boolean {
    return this.files.has(path)
  }
  revisionOf(path: string): number | null {
    return this.files.get(path)?.revision ?? null
  }
  write(path: string, content: string): { bytesWritten: number; newRevision: number } {
    const cur = this.files.get(path)
    const newRevision = (cur?.revision ?? 0) + 1
    this.files.set(path, { content, revision: newRevision })
    return { bytesWritten: Buffer.byteLength(content, "utf8"), newRevision }
  }
}

describe("coda.saveFile MCP tool (D8)", () => {
  test("allowed path writes and reports bytes + revision", async () => {
    const repo = new MemRepo()
    const tool = saveFileTool(repo, ["/allowed"])
    const res = await tool.run({ path: "/allowed/file.ts", content: "hello" }, CTX)
    expect(res.bytesWritten).toBe(5)
    expect(res.newRevision).toBe(1)
  })

  test("tool's allowlist declares the pathsUnder scope for registry enforcement", () => {
    const repo = new MemRepo()
    const tool = saveFileTool(repo, ["/allowed"])
    expect(tool.allowlist.pathsUnder).toEqual(["/allowed"])
    expect(tool.allowlist.readOnly).toBe(false)
    expect(tool.allowlist.workspaceScope).toBe(true)
  })

  test("ifMatchRevision mismatch rejects optimistic write", () => {
    const repo = new MemRepo()
    const tool = saveFileTool(repo, ["/allowed"])
    tool.run({ path: "/allowed/a.ts", content: "v1" }, CTX)
    tool.run({ path: "/allowed/a.ts", content: "v2" }, CTX)
    // file is now at revision 2; supplying ifMatchRevision=1 must fail
    expect(() =>
      tool.run({ path: "/allowed/a.ts", content: "v3", ifMatchRevision: 1 }, CTX),
    ).toThrow(/revision mismatch/)
  })

  test("ifMatchRevision match allows write", async () => {
    const repo = new MemRepo()
    const tool = saveFileTool(repo, ["/allowed"])
    const first = await tool.run({ path: "/allowed/a.ts", content: "v1" }, CTX)
    const second = await tool.run(
      {
        path: "/allowed/a.ts",
        content: "v2",
        ifMatchRevision: first.newRevision,
      },
      CTX,
    )
    expect(second.newRevision).toBe(2)
  })
})
