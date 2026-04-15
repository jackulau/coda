import { z } from "zod"

export const PtySession = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  cwd: z.string().min(1),
  title: z.string(),
  claudeSessionId: z.string().optional(),
  pid: z.number().int().positive().optional(),
  startedAt: z.number().int().nonnegative(),
  exitedAt: z.number().int().nonnegative().optional(),
  exitCode: z.number().int().optional(),
  reattachError: z.string().optional(),
})

export type PtySession = z.infer<typeof PtySession>

export const PTY_BUFFER_BYTES = 2 * 1024 * 1024
export const PTY_REATTACH_BUDGET_MS = 500

const SECRET_ENV_DENYLIST = [
  "ANTHROPIC_API_KEY",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "OPENAI_API_KEY",
] as const

const SECRET_ENV_PATTERNS = [/^AWS_/, /^CODA_.*_SECRET$/]

export function scrubSecretEnv(env: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue
    if ((SECRET_ENV_DENYLIST as readonly string[]).includes(k)) continue
    if (SECRET_ENV_PATTERNS.some((re) => re.test(k))) continue
    out[k] = v
  }
  return out
}
