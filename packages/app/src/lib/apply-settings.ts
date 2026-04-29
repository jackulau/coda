import type {
  AppearanceMode,
  FontFamily,
  SettingsState,
  SidebarPosition,
} from "../pages/settings/settings-store"

/* ------------------------------------------------------------------ */
/*  Pure helpers (testable without DOM)                                */
/* ------------------------------------------------------------------ */

/**
 * Resolve the effective color scheme from the user preference and the
 * system-level `prefers-color-scheme` media query.
 */
export function resolveColorScheme(
  mode: AppearanceMode,
  systemPrefersDark: boolean,
): "light" | "dark" {
  if (mode === "light") return "light"
  if (mode === "dark") return "dark"
  // mode === "system"
  return systemPrefersDark ? "dark" : "light"
}

const MONO_FALLBACKS = '"SF Mono", Menlo, Consolas, monospace'

/**
 * Build a CSS `font-family` value for the chosen monospace font,
 * always appending platform fallbacks.
 */
export function buildFontStack(fontFamily: FontFamily | string): string {
  return `"${fontFamily}", ${MONO_FALLBACKS}`
}

/* ---------- CSS variable maps ------------------------------------ */

/** Dark-mode variables — must match the `:root` block in styles.css. */
export const DARK_VARS: Record<string, string> = {
  "--bg-0": "#0a0a0b",
  "--bg-1": "#121214",
  "--bg-2": "#1a1a1d",
  "--bg-3": "#24242a",
  "--bg-input": "#0d0d0f",
  "--bg-overlay": "rgba(10, 10, 11, 0.85)",
  "--border-subtle": "#1f1f23",
  "--border-default": "#2a2a30",
  "--border-emphasis": "#3a3a44",
  "--text-primary": "#e8e8ec",
  "--text-secondary": "#9a9aa6",
  "--text-tertiary": "#64646e",
  "--accent-500": "#ff6b1a",
  "--accent-glow": "rgba(255, 107, 26, 0.15)",
  "--diff-add": "#3fb950",
  "--diff-remove": "#f85149",
  "--status-idle": "#64646e",
  "--status-run": "#ff6b1a",
  "--status-await": "#e3b341",
  "--status-error": "#f85149",
  "--motion-fast": "120ms cubic-bezier(0.2, 0, 0.2, 1)",
  "--motion-base": "180ms cubic-bezier(0.2, 0, 0.2, 1)",
  "--motion-slow": "280ms cubic-bezier(0.2, 0, 0.2, 1)",
  "--shadow-panel": "0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.25)",
}

/** Light-mode variables — sensible inversions of the dark theme. */
export const LIGHT_VARS: Record<string, string> = {
  "--bg-0": "#f8f8fa",
  "--bg-1": "#f0f0f3",
  "--bg-2": "#e6e6eb",
  "--bg-3": "#dcdce3",
  "--bg-input": "#ffffff",
  "--bg-overlay": "rgba(248, 248, 250, 0.90)",
  "--border-subtle": "#e0e0e6",
  "--border-default": "#d0d0d8",
  "--border-emphasis": "#b8b8c4",
  "--text-primary": "#1a1a22",
  "--text-secondary": "#56566a",
  "--text-tertiary": "#8888a0",
  "--accent-500": "#ff6b1a",
  "--accent-glow": "rgba(255, 107, 26, 0.12)",
  "--diff-add": "#1a7f37",
  "--diff-remove": "#cf222e",
  "--status-idle": "#8888a0",
  "--status-run": "#ff6b1a",
  "--status-await": "#9a6700",
  "--status-error": "#cf222e",
  "--motion-fast": "120ms cubic-bezier(0.2, 0, 0.2, 1)",
  "--motion-base": "180ms cubic-bezier(0.2, 0, 0.2, 1)",
  "--motion-slow": "280ms cubic-bezier(0.2, 0, 0.2, 1)",
  "--shadow-panel": "0 1px 3px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05)",
}

/* ---------- Sidebar position ------------------------------------- */

/** CSS `order` for the sidebar element. */
export function sidebarOrder(position: SidebarPosition): number {
  return position === "left" ? 0 : 2
}

/** CSS `order` for the center panel element. */
export function centerOrder(position: SidebarPosition): number {
  return position === "left" ? 1 : 0
}

/* ---------- Reduced motion --------------------------------------- */

/**
 * Returns `true` when motion should be suppressed — either because the
 * user toggled the in-app setting OR the OS prefers reduced motion.
 */
export function shouldReduceMotion(setting: boolean, osPrefersReduced: boolean): boolean {
  return setting || osPrefersReduced
}

/* ------------------------------------------------------------------ */
/*  DOM side-effects (called from createEffect in app.tsx)            */
/* ------------------------------------------------------------------ */

/**
 * Apply document-level settings derived from the settings store.
 * Designed to be called inside a SolidJS `createEffect` so it re-runs
 * whenever any tracked signal within `settings` changes.
 *
 * Returns a cleanup function that removes any matchMedia listener
 * registered for the "system" appearance mode.
 */
export function applySettingsToDocument(
  settings: SettingsState,
  el: HTMLElement = document.documentElement,
): (() => void) | undefined {
  // --- Color scheme ---------------------------------------------------
  let cleanup: (() => void) | undefined

  if (settings.appearance === "system") {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = (dark: boolean) => {
      const scheme = resolveColorScheme("system", dark)
      applyScheme(scheme, el)
    }
    apply(mql.matches)
    const handler = (e: MediaQueryListEvent) => apply(e.matches)
    mql.addEventListener("change", handler)
    cleanup = () => mql.removeEventListener("change", handler)
  } else {
    const scheme = resolveColorScheme(settings.appearance, false)
    applyScheme(scheme, el)
  }

  // --- Font -----------------------------------------------------------
  el.style.setProperty("--font-mono", buildFontStack(settings.fontFamily))

  // --- Reduced motion -------------------------------------------------
  const osReduced =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  if (shouldReduceMotion(settings.reducedMotion, osReduced)) {
    el.setAttribute("data-reduced-motion", "true")
  } else {
    el.removeAttribute("data-reduced-motion")
  }

  return cleanup
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                  */
/* ------------------------------------------------------------------ */

function applyScheme(scheme: "light" | "dark", el: HTMLElement): void {
  const vars = scheme === "dark" ? DARK_VARS : LIGHT_VARS
  for (const [prop, value] of Object.entries(vars)) {
    el.style.setProperty(prop, value)
  }
  el.style.setProperty("color-scheme", scheme)
}
