import { type Component, type JSX, Show, createSignal, onError } from "solid-js"

interface Props {
  fallback: (err: Error, reset: () => void) => JSX.Element
  children: JSX.Element
}

export const ErrorBoundary: Component<Props> = (props) => {
  const [err, setErr] = createSignal<Error | null>(null)
  onError((e) => {
    setErr(e instanceof Error ? e : new Error(String(e)))
  })
  const reset = (): void => setErr(null)
  return (
    <Show when={err()} fallback={props.children}>
      {(e) => props.fallback(e(), reset)}
    </Show>
  )
}
