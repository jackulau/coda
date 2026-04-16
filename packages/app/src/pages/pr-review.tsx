import type { PrView } from "@coda/core/github"
import { type Component, Show } from "solid-js"

interface Props {
  pr: PrView | null
  onApprove?: () => void
  onComment?: (body: string) => void
}

export const PrReviewPanel: Component<Props> = (props) => {
  return (
    <div data-testid="pr-review-panel">
      <Show when={props.pr} fallback={<div data-testid="pr-review-empty">No PR selected</div>}>
        {(pr) => (
          <div>
            <h2 data-testid="pr-review-title">{pr().title}</h2>
            <div data-testid="pr-review-state">{pr().state}</div>
            <div data-testid="pr-review-author">{pr().author}</div>
            <div data-testid="pr-review-file-count">{pr().files.length}</div>
            <button
              type="button"
              data-testid="pr-review-approve"
              onClick={() => props.onApprove?.()}
            >
              Approve
            </button>
          </div>
        )}
      </Show>
    </div>
  )
}
