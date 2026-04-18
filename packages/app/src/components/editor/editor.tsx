import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { css } from "@codemirror/lang-css"
import { html } from "@codemirror/lang-html"
import { javascript } from "@codemirror/lang-javascript"
import { json } from "@codemirror/lang-json"
import { markdown } from "@codemirror/lang-markdown"
import { python } from "@codemirror/lang-python"
import { rust } from "@codemirror/lang-rust"
import type { Extension } from "@codemirror/state"
import { Compartment, EditorState } from "@codemirror/state"
import { EditorView, keymap, lineNumbers } from "@codemirror/view"
import { type Component, createEffect, onCleanup, onMount } from "solid-js"

export interface EditorProps {
  /** Path of the current buffer; used to pick a language extension. */
  path?: string
  /** Initial content (and controlled content when the path changes). */
  content: string
  /** Called with every change to the buffer. */
  onChange?: (value: string) => void
  /** Called when Cmd/Ctrl+S is pressed inside the editor. */
  onSave?: () => void
}

function extensionForPath(path?: string): Extension {
  if (!path) return []
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  switch (ext) {
    case "ts":
    case "tsx":
      return javascript({ typescript: true, jsx: ext === "tsx" })
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return javascript({ jsx: ext === "jsx" })
    case "json":
      return json()
    case "md":
    case "markdown":
      return markdown()
    case "rs":
      return rust()
    case "py":
      return python()
    case "css":
      return css()
    case "html":
    case "htm":
      return html()
    default:
      return []
  }
}

/**
 * CodeMirror 6 editor, designed so Solid props drive the document. On
 * `content` prop change we dispatch a replacement transaction. On path
 * change we swap the language compartment.
 */
export const Editor: Component<EditorProps> = (props) => {
  let hostRef: HTMLDivElement | undefined
  let view: EditorView | undefined
  const langComp = new Compartment()

  onMount(() => {
    if (!hostRef) return
    const updateListener = EditorView.updateListener.of((u) => {
      if (u.docChanged) props.onChange?.(u.state.doc.toString())
    })
    const saveKey = keymap.of([
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          props.onSave?.()
          return true
        },
      },
    ])
    view = new EditorView({
      state: EditorState.create({
        doc: props.content,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          saveKey,
          updateListener,
          langComp.of(extensionForPath(props.path)),
        ],
      }),
      parent: hostRef,
    })
  })

  // Swap language extension when path changes.
  createEffect(() => {
    if (!view) return
    view.dispatch({
      effects: langComp.reconfigure(extensionForPath(props.path)),
    })
  })

  // Mirror external content changes into the editor without
  // discarding the selection. Dispatching with `selection` preserves
  // cursor position when the incoming text is identical near the
  // caret; if the replacement shortens the doc below the caret, CM6
  // clamps the selection to the new doc end rather than collapsing.
  createEffect(() => {
    const next = props.content
    if (!view) return
    const current = view.state.doc.toString()
    if (current === next) return
    const anchor = Math.min(view.state.selection.main.anchor, next.length)
    const head = Math.min(view.state.selection.main.head, next.length)
    view.dispatch({
      changes: { from: 0, to: current.length, insert: next },
      selection: { anchor, head },
    })
  })

  onCleanup(() => {
    view?.destroy()
  })

  return (
    <div
      data-testid="editor"
      data-editor-path={props.path}
      ref={hostRef}
      style={{ flex: "1 1 auto", "min-height": 0, overflow: "auto" }}
    />
  )
}
