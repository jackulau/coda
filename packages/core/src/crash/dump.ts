import { z } from "zod"
import { redactObject } from "../log/redact"

export const CrashOrigin = z.enum(["renderer", "sidecar", "rust", "worker"])
export type CrashOrigin = z.infer<typeof CrashOrigin>

export const CrashDump = z.object({
  id: z.string().min(1),
  ts: z.number().int().nonnegative(),
  origin: CrashOrigin,
  appVersion: z.string().min(1),
  platform: z.string().min(1),
  arch: z.string().min(1),
  message: z.string(),
  stack: z.string().nullable(),
  sessionId: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(),
  resourceSnapshot: z.record(z.number()).optional(),
  reportedAt: z.number().int().nonnegative(),
})

export type CrashDump = z.infer<typeof CrashDump>

export interface DumpInput {
  origin: CrashOrigin
  appVersion: string
  platform: string
  arch: string
  message: string
  stack?: string | null
  sessionId?: string
  workspaceId?: string
  resourceSnapshot?: Record<string, number>
}

export function buildDump(input: DumpInput, now = Date.now()): CrashDump {
  return CrashDump.parse({
    id: crypto.randomUUID(),
    ts: now,
    origin: input.origin,
    appVersion: input.appVersion,
    platform: input.platform,
    arch: input.arch,
    message: input.message,
    stack: input.stack ?? null,
    ...(input.sessionId !== undefined && { sessionId: input.sessionId }),
    ...(input.workspaceId !== undefined && { workspaceId: input.workspaceId }),
    ...(input.resourceSnapshot !== undefined && {
      resourceSnapshot: input.resourceSnapshot,
    }),
    reportedAt: now,
  })
}

export function redactDump(dump: CrashDump): CrashDump {
  const redacted = redactObject({
    ...dump,
    message: dump.message,
    stack: dump.stack,
  }) as CrashDump
  return CrashDump.parse(redacted)
}

export class CrashIndex {
  private readonly dumps = new Map<string, CrashDump>()
  private readonly max: number

  constructor(max = 50) {
    this.max = max
  }

  add(dump: CrashDump): void {
    this.dumps.set(dump.id, dump)
    if (this.dumps.size > this.max) {
      const oldestKey = this.dumps.keys().next().value
      if (oldestKey) this.dumps.delete(oldestKey)
    }
  }

  list(): CrashDump[] {
    return Array.from(this.dumps.values()).sort((a, b) => b.ts - a.ts)
  }

  filterByOrigin(origin: CrashOrigin): CrashDump[] {
    return this.list().filter((d) => d.origin === origin)
  }

  clear(): void {
    this.dumps.clear()
  }

  size(): number {
    return this.dumps.size
  }
}
