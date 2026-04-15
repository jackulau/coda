import { z } from "zod"

export const ProjectInfo = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  rootPath: z.string().min(1),
  uiOrder: z.number().int().nonnegative().optional(),
  expanded: z.boolean().default(true),
  createdAt: z.number().int().nonnegative(),
})

export type ProjectInfo = z.infer<typeof ProjectInfo>
