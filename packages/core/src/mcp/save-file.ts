import { z } from "zod"
import type { ToolDefinition } from "./tools"

export const SaveFileArgs = z.object({
  path: z.string().min(1),
  content: z.string(),
  ifMatchRevision: z.number().int().nonnegative().optional(),
})

export type SaveFileArgs = z.infer<typeof SaveFileArgs>

export const SaveFileResult = z.object({
  bytesWritten: z.number().int().nonnegative(),
  newRevision: z.number().int().nonnegative(),
})

export type SaveFileResult = z.infer<typeof SaveFileResult>

export interface FileRepository {
  exists(path: string): boolean
  revisionOf(path: string): number | null
  write(path: string, content: string): { bytesWritten: number; newRevision: number }
}

export function saveFileTool(
  repo: FileRepository,
  allowedPaths: string[],
): ToolDefinition<SaveFileArgs, SaveFileResult> {
  return {
    name: "coda.saveFile",
    description: "Save text content to a file inside the focused workspace",
    argsSchema: SaveFileArgs,
    resultSchema: SaveFileResult,
    allowlist: {
      workspaceScope: true,
      readOnly: false,
      pathsUnder: allowedPaths,
    },
    run(args) {
      if (args.ifMatchRevision !== undefined) {
        const current = repo.revisionOf(args.path)
        if (current !== args.ifMatchRevision) {
          throw new Error(`revision mismatch: expected ${args.ifMatchRevision}, got ${current}`)
        }
      }
      const out = repo.write(args.path, args.content)
      return out
    },
  }
}
