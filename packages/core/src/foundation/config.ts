import { z } from "zod"

export const BiomeConfig = z.object({
  $schema: z.string().optional(),
  vcs: z
    .object({ enabled: z.boolean(), clientKind: z.string(), useIgnoreFile: z.boolean() })
    .partial()
    .optional(),
  files: z.object({ ignoreUnknown: z.boolean().optional() }).partial().optional(),
  formatter: z.object({ enabled: z.boolean() }).partial().optional(),
  linter: z.object({ enabled: z.boolean() }).partial().optional(),
  javascript: z
    .object({ formatter: z.record(z.unknown()).optional() })
    .partial()
    .optional(),
})

export type BiomeConfig = z.infer<typeof BiomeConfig>

export const PackageJson = z.object({
  name: z.string(),
  private: z.boolean().optional(),
  workspaces: z.array(z.string()).optional(),
  scripts: z.record(z.string(), z.string()).optional(),
})

export type PackageJson = z.infer<typeof PackageJson>

export interface FoundationAudit {
  configValid: boolean
  workspacesDeclared: boolean
  requiredScripts: string[]
  missingScripts: string[]
}

const REQUIRED_SCRIPTS = ["test", "lint", "typecheck"] as const

export function auditFoundation(
  biome: unknown,
  pkg: unknown,
  required: readonly string[] = REQUIRED_SCRIPTS,
): FoundationAudit {
  const biomeResult = BiomeConfig.safeParse(biome)
  const pkgResult = PackageJson.safeParse(pkg)
  const scripts = pkgResult.success ? Object.keys(pkgResult.data.scripts ?? {}) : []
  const missing = required.filter((r) => !scripts.includes(r))
  return {
    configValid: biomeResult.success && pkgResult.success,
    workspacesDeclared:
      pkgResult.success &&
      Array.isArray(pkgResult.data.workspaces) &&
      pkgResult.data.workspaces.length > 0,
    requiredScripts: [...required],
    missingScripts: missing,
  }
}
