export type WizardStep = "welcome" | "add-project" | "github-auth" | "pick-theme" | "done"

export const STEPS: WizardStep[] = ["welcome", "add-project", "github-auth", "pick-theme", "done"]

export interface WizardState {
  current: WizardStep
  firstProjectPath: string | null
  githubAuthed: boolean
  themeChosen: boolean
}

export function initialWizard(): WizardState {
  return {
    current: "welcome",
    firstProjectPath: null,
    githubAuthed: false,
    themeChosen: false,
  }
}

export function canAdvance(state: WizardState): boolean {
  switch (state.current) {
    case "welcome":
      return true
    case "add-project":
      return state.firstProjectPath !== null && state.firstProjectPath.length > 0
    case "github-auth":
      return true
    case "pick-theme":
      return state.themeChosen
    case "done":
      return false
  }
}

export function advance(state: WizardState): WizardState {
  if (!canAdvance(state)) return state
  const idx = STEPS.indexOf(state.current)
  const next = STEPS[Math.min(idx + 1, STEPS.length - 1)] ?? "done"
  return { ...state, current: next }
}

export function goBack(state: WizardState): WizardState {
  const idx = STEPS.indexOf(state.current)
  const prev = STEPS[Math.max(idx - 1, 0)] ?? "welcome"
  return { ...state, current: prev }
}

export function isComplete(state: WizardState): boolean {
  return state.current === "done"
}
