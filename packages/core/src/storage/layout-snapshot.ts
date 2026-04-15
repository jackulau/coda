import { z } from "zod"

export const LAYOUT_SNAPSHOT_VERSION = 2

export const LayoutSnapshot = z.object({
  version: z.literal(LAYOUT_SNAPSHOT_VERSION),
  focusedWorkspaceId: z.string().nullable(),
  expandedProjects: z.record(z.boolean()),
  panels: z.object({
    sidebarWidth: z.number().int().min(220).max(400),
    rightRailWidth: z.number().int().min(300).max(560),
    portsPanelHeight: z.number().int().min(120),
  }),
  openPrTabs: z.array(
    z.object({
      number: z.number().int().positive(),
      owner: z.string(),
      repo: z.string(),
      activeFilePath: z.string().nullable().optional(),
      scrollTop: z.number().int().nonnegative().optional(),
    }),
  ),
  openBrowserTabs: z.array(
    z.object({
      id: z.string(),
      workspaceId: z.string(),
      url: z.string(),
      pinned: z.boolean().optional(),
    }),
  ),
  terminalTabs: z.array(
    z.object({
      sessionId: z.string(),
      workspaceId: z.string(),
      orderIndex: z.number().int().nonnegative(),
    }),
  ),
  portsPanel: z.object({
    expandedExternal: z.boolean(),
    dismissed: z.array(z.number().int().min(1).max(65535)),
  }),
  capturedAt: z.number().int().nonnegative(),
})

export type LayoutSnapshot = z.infer<typeof LayoutSnapshot>

export function emptySnapshot(now = Date.now()): LayoutSnapshot {
  return {
    version: LAYOUT_SNAPSHOT_VERSION,
    focusedWorkspaceId: null,
    expandedProjects: {},
    panels: { sidebarWidth: 280, rightRailWidth: 380, portsPanelHeight: 180 },
    openPrTabs: [],
    openBrowserTabs: [],
    terminalTabs: [],
    portsPanel: { expandedExternal: false, dismissed: [] },
    capturedAt: now,
  }
}

export interface MigrationContext {
  now: () => number
}

type RawV1 = {
  version: 1
  focusedWorkspaceId?: string | null
  expandedProjects?: Record<string, boolean>
  sidebarWidth?: number
  rightRailWidth?: number
  portsPanelHeight?: number
}

export function migrate(raw: unknown, ctx: MigrationContext = { now: Date.now }): LayoutSnapshot {
  if (!raw || typeof raw !== "object") return emptySnapshot(ctx.now())
  const obj = raw as { version?: unknown }
  if (obj.version === LAYOUT_SNAPSHOT_VERSION) {
    return LayoutSnapshot.parse(raw)
  }
  if (obj.version === 1) {
    const v1 = raw as RawV1
    const out: LayoutSnapshot = {
      version: LAYOUT_SNAPSHOT_VERSION,
      focusedWorkspaceId: v1.focusedWorkspaceId ?? null,
      expandedProjects: v1.expandedProjects ?? {},
      panels: {
        sidebarWidth: clamp(v1.sidebarWidth ?? 280, 220, 400),
        rightRailWidth: clamp(v1.rightRailWidth ?? 380, 300, 560),
        portsPanelHeight: Math.max(v1.portsPanelHeight ?? 180, 120),
      },
      openPrTabs: [],
      openBrowserTabs: [],
      terminalTabs: [],
      portsPanel: { expandedExternal: false, dismissed: [] },
      capturedAt: ctx.now(),
    }
    return LayoutSnapshot.parse(out)
  }
  return emptySnapshot(ctx.now())
}

export function serialize(snapshot: LayoutSnapshot): string {
  const validated = LayoutSnapshot.parse(snapshot)
  return JSON.stringify(validated)
}

export function deserialize(
  json: string,
  ctx: MigrationContext = { now: Date.now },
): LayoutSnapshot {
  try {
    const raw = JSON.parse(json) as unknown
    return migrate(raw, ctx)
  } catch {
    return emptySnapshot(ctx.now())
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
