import { z } from "zod"

export const RemoteTarget = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  host: z.string().min(1),
  user: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(22),
  authKind: z.enum(["agent", "key", "password"]),
  identityFile: z.string().optional(),
  jumpHost: z.string().optional(),
})

export type RemoteTarget = z.infer<typeof RemoteTarget>

export const RemoteSession = z.object({
  id: z.string().min(1),
  targetId: z.string().min(1),
  workspaceId: z.string().min(1),
  startedAt: z.number().int().nonnegative(),
  endedAt: z.number().int().nonnegative().nullable(),
  status: z.enum(["connecting", "connected", "disconnected", "failed"]),
})

export type RemoteSession = z.infer<typeof RemoteSession>

export function buildSshArgs(target: RemoteTarget): string[] {
  const args: string[] = []
  if (target.jumpHost) args.push("-J", target.jumpHost)
  if (target.port !== 22) args.push("-p", String(target.port))
  if (target.authKind === "key" && target.identityFile) args.push("-i", target.identityFile)
  args.push(`${target.user}@${target.host}`)
  return args
}

export interface PortForward {
  localPort: number
  remoteHost: string
  remotePort: number
}

export function forwardArgs(forwards: PortForward[]): string[] {
  return forwards.flatMap((f) => ["-L", `${f.localPort}:${f.remoteHost}:${f.remotePort}`])
}

export function redactIdentityFile(args: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === undefined) continue
    if (a === "-i" && i + 1 < args.length) {
      out.push("-i", "<REDACTED>")
      i++
      continue
    }
    out.push(a)
  }
  return out
}
