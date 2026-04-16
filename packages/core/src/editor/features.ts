import { z } from "zod"

export const EditorFeatures = z.object({
  autoSave: z.boolean().default(true),
  multiCursor: z.boolean().default(true),
  minimap: z.boolean().default(true),
  bracketMatching: z.boolean().default(true),
  folding: z.boolean().default(true),
  snippets: z.boolean().default(true),
  find: z.boolean().default(true),
  zenMode: z.boolean().default(false),
  renderWhitespace: z.enum(["none", "boundary", "all"]).default("boundary"),
})

export type EditorFeatures = z.infer<typeof EditorFeatures>

export function defaultFeatures(): EditorFeatures {
  return EditorFeatures.parse({})
}

export function overlay(base: EditorFeatures, patch: Partial<EditorFeatures>): EditorFeatures {
  return EditorFeatures.parse({ ...base, ...patch })
}
