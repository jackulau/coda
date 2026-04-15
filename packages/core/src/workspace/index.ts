import { z } from "zod"

export const WorkspaceInfo = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(120),
  cwd: z.string().min(1),
  branch: z.string().optional(),
  baseBranch: z.string().default("main"),
  uiOrder: z.number().int().nonnegative().optional(),
  lastFocusedAt: z.number().int().nonnegative().optional(),
  pinned: z.boolean().default(false),
  createdAt: z.number().int().nonnegative(),
})

export type WorkspaceInfo = z.infer<typeof WorkspaceInfo>

export const WorkspaceDiffStat = z.object({
  workspaceId: z.string().uuid(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  files: z.number().int().nonnegative(),
  computedAt: z.number().int().nonnegative(),
})

export type WorkspaceDiffStat = z.infer<typeof WorkspaceDiffStat>

export const AgentStatus = z.enum(["idle", "running", "awaiting-input", "error"])
export type AgentStatus = z.infer<typeof AgentStatus>
