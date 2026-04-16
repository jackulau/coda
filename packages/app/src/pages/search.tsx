import { type Component, For, Show, createSignal } from "solid-js"

export interface SearchHit {
  file: string
  line: number
  preview: string
}

interface Props {
  onSearch?: (query: string) => SearchHit[] | Promise<SearchHit[]>
}

export const SearchPage: Component<Props> = (props) => {
  const [q, setQ] = createSignal("")
  const [hits, setHits] = createSignal<SearchHit[]>([])
  const run = async () => {
    const out = await (props.onSearch?.(q()) ?? Promise.resolve([]))
    setHits(out)
  }
  return (
    <div data-testid="search-page">
      <input
        data-testid="search-input"
        value={q()}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
      />
      <button type="button" data-testid="search-go" onClick={run}>
        Search
      </button>
      <Show when={hits().length === 0}>
        <div data-testid="search-empty">No matches</div>
      </Show>
      <For each={hits()}>
        {(h) => (
          <div data-testid={`search-hit-${h.file}-${h.line}`}>
            {h.file}:{h.line} — {h.preview}
          </div>
        )}
      </For>
    </div>
  )
}
