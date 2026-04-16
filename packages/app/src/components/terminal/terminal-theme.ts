import { findTheme } from "@coda/ui/themes/catalog"

export function terminalThemeFor(id: string): { background: string; foreground: string } {
  const t = findTheme(id)
  if (!t) throw new Error(`unknown theme: ${id}`)
  return { ...t.terminalPalette }
}
