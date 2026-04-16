import type { Component } from "solid-js"

interface Props {
  onAddProject?: () => void
  onSkip?: () => void
}

export const WelcomePage: Component<Props> = (props) => {
  return (
    <div data-testid="welcome-page">
      <h1>Welcome to Coda</h1>
      <button
        type="button"
        data-testid="welcome-add-project"
        onClick={() => props.onAddProject?.()}
      >
        Add First Project
      </button>
      <button type="button" data-testid="welcome-skip" onClick={() => props.onSkip?.()}>
        Skip
      </button>
    </div>
  )
}
