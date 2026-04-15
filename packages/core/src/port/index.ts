import { z } from "zod"

export const PortInfo = z.object({
  port: z.number().int().min(1).max(65535),
  pid: z.number().int().positive(),
  command: z.string(),
  workspaceId: z.string().uuid().optional(),
  external: z.boolean().default(false),
  bindAddress: z.string(),
})

export type PortInfo = z.infer<typeof PortInfo>

export function isLocalBindAddress(addr: string): boolean {
  return addr === "127.0.0.1" || addr === "::1" || addr === "localhost" || addr === "0.0.0.0"
}
