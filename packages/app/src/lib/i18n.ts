import { createSignal } from "solid-js"
import type { Language } from "../pages/settings/settings-store"
import { en } from "./locales/en"

const locales: Record<string, Record<string, string>> = { en }

// Other locales start as English copies — to be translated later
for (const lang of ["zh-CN", "zh-TW", "ko", "de", "es", "fr"]) {
  locales[lang] = { ...en }
}

const [currentLocale, setCurrentLocale] = createSignal<string>("en")

export function setLocale(lang: Language): void {
  setCurrentLocale(lang)
}

export function t(key: string): string {
  return locales[currentLocale()]?.[key] ?? locales.en?.[key] ?? key
}
