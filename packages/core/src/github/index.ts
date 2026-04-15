import { z } from "zod"

export const PrFileStatus = z.enum(["added", "modified", "removed", "renamed"])
export type PrFileStatus = z.infer<typeof PrFileStatus>

export const PrFile = z.object({
  path: z.string().min(1),
  status: PrFileStatus,
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  patch: z.string().nullable(),
  blobUrl: z.string().url().optional(),
})

export type PrFile = z.infer<typeof PrFile>

export const PrView = z.object({
  number: z.number().int().positive(),
  state: z.enum(["open", "closed", "merged"]),
  title: z.string(),
  headSha: z.string().regex(/^[0-9a-f]{7,40}$/),
  baseSha: z.string().regex(/^[0-9a-f]{7,40}$/),
  author: z.string(),
  files: z.array(PrFile),
  reviewDecision: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENTED"]).optional(),
  truncated: z.boolean().optional(),
})

export type PrView = z.infer<typeof PrView>
