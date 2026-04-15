import { createHash } from "node:crypto"
import { z } from "zod"

export const FlagDefinition = z.object({
  key: z.string().min(1),
  enabled: z.boolean().default(false),
  rolloutPercent: z.number().int().min(0).max(100).default(100),
  killSwitch: z.boolean().default(false),
  enabledFor: z.array(z.string()).optional(),
})

export type FlagDefinition = z.infer<typeof FlagDefinition>

export interface FlagContext {
  userId?: string
  workspaceId?: string
  app: { version: string; channel: "stable" | "beta" | "canary" }
}

export interface FlagEvaluator {
  isOn(key: string, ctx: FlagContext): boolean
  upsert(def: FlagDefinition): void
  killSwitch(key: string): void
  list(): FlagDefinition[]
}

export class StaticFlagEvaluator implements FlagEvaluator {
  private flags = new Map<string, FlagDefinition>()

  constructor(initial: FlagDefinition[] = []) {
    for (const f of initial) this.upsert(f)
  }

  upsert(def: FlagDefinition): void {
    const parsed = FlagDefinition.parse(def)
    this.flags.set(parsed.key, parsed)
  }

  killSwitch(key: string): void {
    const f = this.flags.get(key)
    if (!f) return
    this.flags.set(key, { ...f, killSwitch: true })
  }

  list(): FlagDefinition[] {
    return Array.from(this.flags.values())
  }

  isOn(key: string, ctx: FlagContext): boolean {
    const flag = this.flags.get(key)
    if (!flag) return false
    if (flag.killSwitch) return false
    if (!flag.enabled) return false
    if (flag.enabledFor && ctx.userId && flag.enabledFor.includes(ctx.userId)) {
      return true
    }
    if (flag.rolloutPercent >= 100) return true
    if (flag.rolloutPercent <= 0) return false
    const subject = ctx.userId ?? ctx.workspaceId ?? ""
    const bucket = bucketFor(`${key}:${subject}`)
    return bucket < flag.rolloutPercent
  }
}

function bucketFor(seed: string): number {
  const h = createHash("sha256").update(seed).digest()
  const n = (h.readUInt32BE(0) ?? 0) % 100
  return n
}
