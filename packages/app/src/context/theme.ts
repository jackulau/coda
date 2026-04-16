import { findTheme } from "@coda/ui/themes/catalog"

export interface ThemePreference {
  id: string
  reducedMotion: boolean
}

const DEFAULT_PREF: ThemePreference = { id: "coda-dark", reducedMotion: false }

export function resolvePreference(pref: Partial<ThemePreference>): ThemePreference {
  const id = pref.id && findTheme(pref.id) ? pref.id : DEFAULT_PREF.id
  return { id, reducedMotion: pref.reducedMotion ?? DEFAULT_PREF.reducedMotion }
}
