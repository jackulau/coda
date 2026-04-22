import { findTheme } from "@coda/ui/themes/catalog"

export function terminalThemeFor(id: string): { background: string; foreground: string } {
  // biome-ignore lint/style/noNonNullAssertion: vesper is always in the catalog
  const t = findTheme(id) ?? findTheme("vesper")!
  return { ...t.terminalPalette }
}
