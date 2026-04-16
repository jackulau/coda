import { type Component, createSignal } from "solid-js"

interface Props {
  onSavePat?: (token: string) => void
}

export const SettingsPage: Component<Props> = (props) => {
  const [pat, setPat] = createSignal("")
  return (
    <div data-testid="settings-page">
      <label>
        GitHub PAT
        <input
          type="password"
          data-testid="settings-pat-input"
          value={pat()}
          onInput={(e) => setPat((e.target as HTMLInputElement).value)}
        />
      </label>
      <button
        type="button"
        data-testid="settings-save-pat"
        onClick={() => props.onSavePat?.(pat())}
      >
        Save
      </button>
    </div>
  )
}
