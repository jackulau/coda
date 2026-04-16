import { z } from "zod"

export const McpToolCall = z.object({
  name: z.string().min(1).max(100),
  arguments: z.record(z.unknown()).default({}),
  callId: z.string().uuid(),
})

export type McpToolCall = z.infer<typeof McpToolCall>

export interface ToolDefinition<A, R> {
  name: string
  description: string
  argsSchema: z.ZodType<A>
  resultSchema: z.ZodType<R>
  allowlist: {
    workspaceScope: boolean
    readOnly: boolean
    pathsUnder?: string[]
  }
  run(args: A, ctx: ToolContext): Promise<R> | R
}

export interface ToolContext {
  workspaceId: string | null
  workspaceCwd: string | null
  userRequestedAt: number
}

export interface ToolDispatchResult {
  ok: true
  callId: string
  name: string
  result: unknown
}

export interface ToolDispatchError {
  ok: false
  callId: string
  code: "unknown-tool" | "bad-args" | "not-allowed" | "handler-threw"
  message: string
}

export class McpRegistry {
  private readonly tools = new Map<string, ToolDefinition<unknown, unknown>>()

  register<A, R>(tool: ToolDefinition<A, R>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`tool already registered: ${tool.name}`)
    }
    this.tools.set(tool.name, tool as ToolDefinition<unknown, unknown>)
  }

  list(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }))
  }

  async dispatch(call: unknown, ctx: ToolContext): Promise<ToolDispatchResult | ToolDispatchError> {
    let parsed: McpToolCall
    try {
      parsed = McpToolCall.parse(call)
    } catch (err) {
      return {
        ok: false,
        callId: "00000000-0000-0000-0000-000000000000",
        code: "bad-args",
        message: err instanceof Error ? err.message : String(err),
      }
    }
    const tool = this.tools.get(parsed.name)
    if (!tool) {
      return {
        ok: false,
        callId: parsed.callId,
        code: "unknown-tool",
        message: `no tool named ${parsed.name}`,
      }
    }
    if (tool.allowlist.workspaceScope && !ctx.workspaceId) {
      return {
        ok: false,
        callId: parsed.callId,
        code: "not-allowed",
        message: "workspace-scoped tool requires focused workspace",
      }
    }
    if (tool.allowlist.pathsUnder && tool.allowlist.pathsUnder.length > 0) {
      const path = extractPathArg(parsed.arguments)
      if (path && !isUnderAllowed(path, tool.allowlist.pathsUnder)) {
        return {
          ok: false,
          callId: parsed.callId,
          code: "not-allowed",
          message: `path ${path} is outside the allowlist`,
        }
      }
    }
    let typedArgs: unknown
    try {
      typedArgs = tool.argsSchema.parse(parsed.arguments)
    } catch (err) {
      return {
        ok: false,
        callId: parsed.callId,
        code: "bad-args",
        message: err instanceof Error ? err.message : String(err),
      }
    }
    try {
      const result = await tool.run(typedArgs, ctx)
      return { ok: true, callId: parsed.callId, name: parsed.name, result }
    } catch (err) {
      return {
        ok: false,
        callId: parsed.callId,
        code: "handler-threw",
        message: err instanceof Error ? err.message : String(err),
      }
    }
  }
}

function extractPathArg(args: Record<string, unknown>): string | null {
  const candidate = args.path ?? args.file ?? args.filePath
  return typeof candidate === "string" ? candidate : null
}

function isUnderAllowed(path: string, allowed: string[]): boolean {
  for (const a of allowed) {
    if (path === a || path.startsWith(`${a}/`)) return true
  }
  return false
}
