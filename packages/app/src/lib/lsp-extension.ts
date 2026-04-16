// LSP editor adapter.
//
// This module produces an "Extension" object that wires an `LspClient` into an
// editor. It is shaped to slot into CodeMirror 6's `Extension` API (which at
// the type level is structurally `{} | readonly Extension[]`), but we do not
// hard-depend on `@codemirror/*` so the app can opt in to CM lazily. The
// extension defines the contract the editor layer needs:
//
//   attach(editor) → subscribe to change/hover/completion/definition events,
//                    send didOpen
//   detach()       → send didClose, clean up listeners and timers
//
// Business-logic tests instantiate the extension against an in-memory
// `EditorHandle` (see `lsp-extension.vitest.ts`) and assert that the right
// LSP messages flow.
//
// Offline mode: if the LspClient is `stopped`, every operation silently no-ops
// so the editor keeps working.

import type { LspClient } from "@coda/core/lsp/client"

export interface EditorPosition {
  line: number // 0-based
  character: number // 0-based
}

export interface TextDocumentChange {
  text: string
  version: number
}

export interface Diagnostic {
  range: { start: EditorPosition; end: EditorPosition }
  severity?: 1 | 2 | 3 | 4
  code?: string | number
  source?: string
  message: string
}

export interface CompletionItem {
  label: string
  detail?: string
  documentation?: string
  insertText?: string
  kind?: number
}

export interface HoverInfo {
  contents: string
  range?: { start: EditorPosition; end: EditorPosition }
}

export interface DefinitionLocation {
  uri: string
  range: { start: EditorPosition; end: EditorPosition }
}

/**
 * Minimal editor surface the extension needs. CodeMirror, Monaco, or a test
 * double all satisfy this shape.
 */
export interface EditorHandle {
  readonly uri: string
  readonly languageId: string
  getVersion(): number
  getText(): string
  /** Subscribe to text changes. Returns an unsubscribe fn. */
  onDidChangeContent(handler: (change: TextDocumentChange) => void): () => void
  /** Subscribe to hover events (user dwells on a position). */
  onDidHover(handler: (pos: EditorPosition) => void): () => void
  /** Subscribe to user-triggered completion requests. */
  onCompletionRequested(handler: (pos: EditorPosition) => void): () => void
  /** Subscribe to definition-jump requests (ctrl-click / cmd-click). */
  onDefinitionRequested(handler: (pos: EditorPosition) => void): () => void
  /** Render diagnostics in the editor. */
  showDiagnostics(diags: Diagnostic[]): void
  /** Show a completion popup. */
  showCompletions(pos: EditorPosition, items: CompletionItem[]): void
  /** Show a hover tooltip. */
  showHover(pos: EditorPosition, info: HoverInfo | null): void
  /** Navigate to a definition. */
  navigateToDefinition(locations: DefinitionLocation[]): void
}

export interface LspExtensionOptions {
  client: LspClient
  /** ms to wait after last change before sending didChange. Default 150. */
  changeDebounceMs?: number
  /** Override setTimeout/clearTimeout — used in tests to drive the clock. */
  setTimeoutFn?: (fn: () => void, ms: number) => unknown
  clearTimeoutFn?: (h: unknown) => void
}

/**
 * Shape returned by `createLspExtension`. Deliberately structural so the same
 * object satisfies CodeMirror 6's `Extension` type without coupling to its
 * types. The `attach` / `detach` methods are the operational surface.
 */
export interface LspExtension {
  attach(editor: EditorHandle): void
  detach(): void
  /** For tests: current attached editor, if any. */
  readonly editor: EditorHandle | null
  /** For tests: true while change debounce timer is pending. */
  hasPendingChange(): boolean
}

export function createLspExtension(opts: LspExtensionOptions): LspExtension {
  const {
    client,
    changeDebounceMs = 150,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  } = opts

  let editor: EditorHandle | null = null
  let disposers: Array<() => void> = []
  let changeTimer: unknown = null
  let pendingVersion = 0
  let pendingText = ""

  const isActive = () => client.state === "running"

  const sendChange = () => {
    if (!editor || !isActive()) return
    try {
      client.sendNotification("textDocument/didChange", {
        textDocument: { uri: editor.uri, version: pendingVersion },
        contentChanges: [{ text: pendingText }],
      })
    } catch {
      // client may have stopped between scheduling and firing — silent no-op
    }
  }

  const scheduleChange = (c: TextDocumentChange) => {
    pendingVersion = c.version
    pendingText = c.text
    if (changeTimer !== null) clearTimeoutFn(changeTimer)
    changeTimer = setTimeoutFn(() => {
      changeTimer = null
      sendChange()
    }, changeDebounceMs)
  }

  const flushPendingChange = () => {
    if (changeTimer !== null) {
      clearTimeoutFn(changeTimer)
      changeTimer = null
    }
  }

  const onDiagnostics = (raw: unknown) => {
    if (!editor) return
    const params = raw as {
      uri?: string
      diagnostics?: Diagnostic[]
    }
    if (!params || params.uri !== editor.uri) return
    editor.showDiagnostics(params.diagnostics ?? [])
  }

  const handleCompletion = async (pos: EditorPosition) => {
    if (!editor || !isActive()) return
    if (!client.supports("completionProvider")) return
    try {
      const raw = await client.sendRequest<unknown>("textDocument/completion", {
        textDocument: { uri: editor.uri },
        position: pos,
      })
      editor.showCompletions(pos, normalizeCompletion(raw))
    } catch {
      // Treat any error as "no completions"
      editor.showCompletions(pos, [])
    }
  }

  const handleHover = async (pos: EditorPosition) => {
    if (!editor || !isActive()) return
    if (!client.supports("hoverProvider")) return
    try {
      const raw = await client.sendRequest<unknown>("textDocument/hover", {
        textDocument: { uri: editor.uri },
        position: pos,
      })
      editor.showHover(pos, normalizeHover(raw))
    } catch {
      editor.showHover(pos, null)
    }
  }

  const handleDefinition = async (pos: EditorPosition) => {
    if (!editor || !isActive()) return
    if (!client.supports("definitionProvider")) return
    try {
      const raw = await client.sendRequest<unknown>("textDocument/definition", {
        textDocument: { uri: editor.uri },
        position: pos,
      })
      editor.navigateToDefinition(normalizeDefinition(raw))
    } catch {
      editor.navigateToDefinition([])
    }
  }

  return {
    attach(e: EditorHandle) {
      if (editor) {
        // Idempotent: detach previous editor first.
        this.detach()
      }
      editor = e
      if (!isActive()) {
        // Offline: register a no-op detach that still clears the field.
        disposers.push(() => {})
        return
      }
      try {
        client.sendNotification("textDocument/didOpen", {
          textDocument: {
            uri: e.uri,
            languageId: e.languageId,
            version: e.getVersion(),
            text: e.getText(),
          },
        })
      } catch {
        // transport closed mid-attach — keep extension in a safe no-op state
      }

      disposers.push(e.onDidChangeContent(scheduleChange))
      disposers.push(e.onDidHover(handleHover))
      disposers.push(e.onCompletionRequested(handleCompletion))
      disposers.push(e.onDefinitionRequested(handleDefinition))
      disposers.push(client.onNotification("textDocument/publishDiagnostics", onDiagnostics))
    },

    detach() {
      flushPendingChange()
      const uri = editor?.uri
      const snapshot = disposers
      disposers = []
      for (const fn of snapshot) {
        try {
          fn()
        } catch {
          // swallow cleanup errors
        }
      }
      if (uri && isActive()) {
        try {
          client.sendNotification("textDocument/didClose", {
            textDocument: { uri },
          })
        } catch {
          // ignore
        }
      }
      editor = null
    },

    get editor() {
      return editor
    },

    hasPendingChange() {
      return changeTimer !== null
    },
  }
}

export function normalizeCompletion(raw: unknown): CompletionItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as CompletionItem[]
  if (typeof raw === "object" && "items" in raw) {
    const items = (raw as { items?: unknown }).items
    return Array.isArray(items) ? (items as CompletionItem[]) : []
  }
  return []
}

export function normalizeHover(raw: unknown): HoverInfo | null {
  if (!raw || typeof raw !== "object") return null
  const obj = raw as { contents?: unknown; range?: HoverInfo["range"] }
  const c = obj.contents
  let contents = ""
  if (typeof c === "string") contents = c
  else if (Array.isArray(c)) {
    contents = c
      .map((m) => (typeof m === "string" ? m : (m as { value?: string }).value ?? ""))
      .filter(Boolean)
      .join("\n\n")
  } else if (c && typeof c === "object") {
    contents = (c as { value?: string }).value ?? ""
  }
  if (!contents) return null
  return { contents, range: obj.range }
}

export function normalizeDefinition(raw: unknown): DefinitionLocation[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as DefinitionLocation[]
  if (typeof raw === "object" && "uri" in (raw as object) && "range" in (raw as object)) {
    return [raw as DefinitionLocation]
  }
  return []
}
