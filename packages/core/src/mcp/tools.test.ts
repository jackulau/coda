import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { McpRegistry, type ToolContext } from "./tools"

const ctx: ToolContext = {
  workspaceId: "ws-1",
  workspaceCwd: "/tmp/ws",
  userRequestedAt: 0,
}

describe("McpRegistry.dispatch", () => {
  test("unknown tool returns unknown-tool error", async () => {
    const r = new McpRegistry()
    const out = await r.dispatch({ name: "nope", arguments: {}, callId: crypto.randomUUID() }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe("unknown-tool")
  })

  test("successful call returns result", async () => {
    const r = new McpRegistry()
    r.register({
      name: "echo",
      description: "echo",
      argsSchema: z.object({ msg: z.string() }),
      resultSchema: z.string(),
      allowlist: { workspaceScope: false, readOnly: true },
      run: (args) => args.msg.toUpperCase(),
    })
    const out = await r.dispatch(
      { name: "echo", arguments: { msg: "hi" }, callId: crypto.randomUUID() },
      ctx,
    )
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.result).toBe("HI")
  })

  test("bad args rejected by schema", async () => {
    const r = new McpRegistry()
    r.register({
      name: "echo",
      description: "echo",
      argsSchema: z.object({ msg: z.string() }),
      resultSchema: z.string(),
      allowlist: { workspaceScope: false, readOnly: true },
      run: (args) => args.msg,
    })
    const out = await r.dispatch(
      { name: "echo", arguments: { msg: 42 }, callId: crypto.randomUUID() },
      ctx,
    )
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe("bad-args")
  })

  test("workspaceScope tool rejects when no workspace", async () => {
    const r = new McpRegistry()
    r.register({
      name: "save",
      description: "save",
      argsSchema: z.object({}),
      resultSchema: z.void(),
      allowlist: { workspaceScope: true, readOnly: false },
      run: () => undefined,
    })
    const out = await r.dispatch(
      { name: "save", arguments: {}, callId: crypto.randomUUID() },
      { ...ctx, workspaceId: null },
    )
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe("not-allowed")
  })

  test("pathsUnder rejects outside paths", async () => {
    const r = new McpRegistry()
    r.register({
      name: "read",
      description: "read",
      argsSchema: z.object({ path: z.string() }),
      resultSchema: z.string(),
      allowlist: { workspaceScope: false, readOnly: true, pathsUnder: ["/allowed"] },
      run: () => "content",
    })
    const bad = await r.dispatch(
      { name: "read", arguments: { path: "/etc/passwd" }, callId: crypto.randomUUID() },
      ctx,
    )
    expect(bad.ok).toBe(false)
    const good = await r.dispatch(
      { name: "read", arguments: { path: "/allowed/sub.txt" }, callId: crypto.randomUUID() },
      ctx,
    )
    expect(good.ok).toBe(true)
  })

  test("handler throwing is caught", async () => {
    const r = new McpRegistry()
    r.register({
      name: "boom",
      description: "boom",
      argsSchema: z.object({}),
      resultSchema: z.void(),
      allowlist: { workspaceScope: false, readOnly: true },
      run: () => {
        throw new Error("blew up")
      },
    })
    const out = await r.dispatch({ name: "boom", arguments: {}, callId: crypto.randomUUID() }, ctx)
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.code).toBe("handler-threw")
      expect(out.message).toBe("blew up")
    }
  })

  test("duplicate registration throws", () => {
    const r = new McpRegistry()
    const def = {
      name: "x",
      description: "x",
      argsSchema: z.object({}),
      resultSchema: z.void(),
      allowlist: { workspaceScope: false, readOnly: true },
      run: () => undefined,
    }
    r.register(def)
    expect(() => r.register(def)).toThrow(/already registered/)
  })
})
