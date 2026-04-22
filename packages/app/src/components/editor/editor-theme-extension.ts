import { findTheme } from "@coda/ui/themes/catalog"

export function editorThemeFor(id: string): {
  background: string
  foreground: string
  accent: string
} {
  // biome-ignore lint/style/noNonNullAssertion: vesper is always in the catalog
  const t = findTheme(id) ?? findTheme("vesper")!
  return { ...t.editorPalette }
}
