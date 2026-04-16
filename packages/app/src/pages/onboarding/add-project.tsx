import { type Component, createSignal } from "solid-js"

interface Props {
  onSubmit?: (args: { name: string; rootPath: string }) => void
}

export const AddProjectForm: Component<Props> = (props) => {
  const [name, setName] = createSignal("")
  const [path, setPath] = createSignal("")
  const submit = (e: Event) => {
    e.preventDefault()
    if (!name() || !path()) return
    props.onSubmit?.({ name: name(), rootPath: path() })
  }
  return (
    <form data-testid="add-project-form" onSubmit={submit}>
      <input
        data-testid="project-name"
        value={name()}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
      />
      <input
        data-testid="project-root-path"
        value={path()}
        onInput={(e) => setPath((e.target as HTMLInputElement).value)}
      />
      <button type="submit" data-testid="add-project-submit">
        Add
      </button>
    </form>
  )
}
