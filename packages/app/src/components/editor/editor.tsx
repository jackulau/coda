import { type Component, createSignal } from "solid-js"

interface Props {
  initial?: string
  onChange?: (value: string) => void
}

export const Editor: Component<Props> = (props) => {
  const [value, setValue] = createSignal(props.initial ?? "")
  const onInput = (e: Event) => {
    const v = (e.target as HTMLTextAreaElement).value
    setValue(v)
    props.onChange?.(v)
  }
  return (
    <div data-testid="editor">
      <textarea data-testid="editor-textarea" value={value()} onInput={onInput} />
      <div data-testid="editor-line-count">{value().split("\n").length}</div>
    </div>
  )
}
