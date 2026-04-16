export type MotionPreference = "full" | "reduced"

export interface MotionPolicy {
  preference: MotionPreference
  transitionMs(tier: "fast" | "base" | "slow"): number
  pulseEnabled(): boolean
}

const DEFAULT_MS: Record<"fast" | "base" | "slow", number> = {
  fast: 120,
  base: 180,
  slow: 280,
}

export function createMotionPolicy(preference: MotionPreference): MotionPolicy {
  return {
    preference,
    transitionMs(tier) {
      return preference === "reduced" ? 0 : DEFAULT_MS[tier]
    },
    pulseEnabled() {
      return preference === "full"
    },
  }
}

export function preferenceFromMedia(match: { matches: boolean } | null): MotionPreference {
  return match?.matches ? "reduced" : "full"
}
