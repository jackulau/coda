import { type Component, For } from "solid-js"

type Channel = "stable" | "beta" | "canary"

interface Props {
  currentVersion: string
  channel: Channel
  onChannelChange?: (c: Channel) => void
  onCheckNow?: () => void
}

const CHANNELS: Channel[] = ["stable", "beta", "canary"]

export const UpdatesPage: Component<Props> = (props) => {
  return (
    <div data-testid="updates-page">
      <div data-testid="current-version">{props.currentVersion}</div>
      <div data-testid="channel-select" data-value={props.channel}>
        <For each={CHANNELS}>
          {(c) => (
            <button
              type="button"
              data-testid={`channel-${c}`}
              data-active={props.channel === c ? "true" : "false"}
              onClick={() => props.onChannelChange?.(c)}
            >
              {c}
            </button>
          )}
        </For>
      </div>
      <button type="button" data-testid="check-now" onClick={() => props.onCheckNow?.()}>
        Check for updates
      </button>
    </div>
  )
}
