import { findTheme } from "@coda/ui/themes/catalog"

export function editorThemeFor(id: string): {
  background: string
  foreground: string
  accent: string
} {
  const t = findTheme(id)
  if (!t) throw new Error(`unknown theme: ${id}`)
  return { ...t.editorPalette }
}
