import {
  DEFAULT_TERMINAL_SETTINGS,
  type TerminalSettings,
} from "@coda/core/terminal-settings/settings"
import { type Component, createSignal } from "solid-js"

interface Props {
  initial?: TerminalSettings
  onChange?: (next: TerminalSettings) => void
}

export const TerminalSettingsPage: Component<Props> = (props) => {
  const [settings, setSettings] = createSignal<TerminalSettings>(
    props.initial ?? DEFAULT_TERMINAL_SETTINGS,
  )
  const onFontSize = (e: Event) => {
    const v = Number((e.target as HTMLInputElement).value)
    const next = { ...settings(), fontSize: v }
    setSettings(next)
    props.onChange?.(next)
  }
  return (
    <div data-testid="terminal-settings-page">
      <label>
        Font size
        <input
          type="number"
          data-testid="terminal-font-size"
          min={10}
          max={24}
          value={settings().fontSize}
          onInput={onFontSize}
        />
      </label>
      <div data-testid="terminal-cursor-style">{settings().cursorStyle}</div>
      <div data-testid="terminal-scrollback">{settings().scrollback}</div>
    </div>
  )
}
