export type MemoryTier = "comfortable" | "elevated" | "pressure" | "critical"

export interface QuotaTier {
  name: MemoryTier
  thresholdMb: number
  shed: ShedAction[]
}

export type ShedAction =
  | "trim-pr-cache"
  | "trim-file-cache"
  | "trim-history"
  | "close-background-browser-tabs"
  | "drop-undo-stacks"
  | "evict-inactive-pty-buffers"
  | "force-gc-hint"

const TIERS: QuotaTier[] = [
  { name: "comfortable", thresholdMb: Number.POSITIVE_INFINITY, shed: [] },
  { name: "elevated", thresholdMb: 800, shed: ["trim-pr-cache", "trim-history"] },
  {
    name: "pressure",
    thresholdMb: 400,
    shed: [
      "trim-pr-cache",
      "trim-file-cache",
      "trim-history",
      "close-background-browser-tabs",
      "force-gc-hint",
    ],
  },
  {
    name: "critical",
    thresholdMb: 200,
    shed: [
      "trim-pr-cache",
      "trim-file-cache",
      "trim-history",
      "close-background-browser-tabs",
      "drop-undo-stacks",
      "evict-inactive-pty-buffers",
      "force-gc-hint",
    ],
  },
]

export function tierFromAvailable(availableMb: number): QuotaTier {
  if (availableMb <= 200) return TIERS[3] as QuotaTier
  if (availableMb <= 400) return TIERS[2] as QuotaTier
  if (availableMb <= 800) return TIERS[1] as QuotaTier
  return TIERS[0] as QuotaTier
}

export function shouldShed(availableMb: number, action: ShedAction): boolean {
  return tierFromAvailable(availableMb).shed.includes(action)
}

export function recommendedActions(availableMb: number): ShedAction[] {
  return [...tierFromAvailable(availableMb).shed]
}
