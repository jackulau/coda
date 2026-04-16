// R5: CodeMirror LSP adapter tests.
//
// We test the extension against a fake `EditorHandle` and a fake `LspClient`,
// asserting the correct LSP messages flow in each direction. No real
// CodeMirror is required — the extension is structurally compatible with
// CM6's `Extension` shape but framework-agnostic.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  type CompletionItem,
  type Diagnostic,
  type DefinitionLocation,
  type EditorHandle,
  type EditorPosition,
  type HoverInfo,
  type LspExtension,
  createLspExtension,
  normalizeCompletion,
  normalizeDefinition,
  normalizeHover,
} from "./lsp-extension"

// ---- test fakes -------------------------------------------------------------

interface FakeClient {
  state: "starting" | "initialized" | "running" | "stopping" | "stopped"
  capabilities: Record<string, unknown>
  notifications: Array<{ method: string; params: unknown }>
  requests: Array<{ method: string; params: unknown }>
  nextRequestResult: unknown
  nextRequestError: Error | null
  notificationHandlers: Map<string, (params: unknown) => void>
  supports(feature: string): boolean
  sendNotification(method: string, params: unknown): void
  sendRequest<T>(method: string, params: unknown): Promise<T>
  onNotification(method: string, handler: (params: unknown) => void): () => void
}

function makeClient(overrides: Partial<FakeClient> = {}): FakeClient {
  const c: FakeClient = {
    state: "running",
    capabilities: {
      completionProvider: true,
      hoverProvider: true,
      definitionProvider: true,
    },
    notifications: [],
    requests: [],
    nextRequestResult: null,
    nextRequestError: null,
    notificationHandlers: new Map(),
    supports(feature) {
      const v = this.capabilities[feature]
      if (v === undefined || v === null) return false
      if (typeof v === "boolean") return v
      return true
    },
    sendNotification(method, params) {
      this.notifications.push({ method, params })
    },
    async sendRequest<T>(method: string, params: unknown): Promise<T> {
      this.requests.push({ method, params })
      if (this.nextRequestError) throw this.nextRequestError
      return this.nextRequestResult as T
    },
    onNotification(method, handler) {
      this.notificationHandlers.set(method, handler)
      return () => this.notificationHandlers.delete(method)
    },
    ...overrides,
  }
  return c
}

interface FakeEditor extends EditorHandle {
  emitChange(change: { text: string; version: number }): void
  emitHover(pos: EditorPosition): void
  emitCompletionRequest(pos: EditorPosition): void
  emitDefinitionRequest(pos: EditorPosition): void
  diagnostics: Diagnostic[][]
  completions: Array<{ pos: EditorPosition; items: CompletionItem[] }>
  hovers: Array<{ pos: EditorPosition; info: HoverInfo | null }>
  definitions: DefinitionLocation[][]
}

function makeEditor(uri = "file:///tmp/a.ts"): FakeEditor {
  let version = 1
  let text = ""
  const listeners = {
    change: new Set<(c: { text: string; version: number }) => void>(),
    hover: new Set<(p: EditorPosition) => void>(),
    completion: new Set<(p: EditorPosition) => void>(),
    definition: new Set<(p: EditorPosition) => void>(),
  }
  const e: FakeEditor = {
    uri,
    languageId: "typescript",
    getVersion: () => version,
    getText: () => text,
    onDidChangeContent(h) {
      listeners.change.add(h)
      return () => listeners.change.delete(h)
    },
    onDidHover(h) {
      listeners.hover.add(h)
      return () => listeners.hover.delete(h)
    },
    onCompletionRequested(h) {
      listeners.completion.add(h)
      return () => listeners.completion.delete(h)
    },
    onDefinitionRequested(h) {
      listeners.definition.add(h)
      return () => listeners.definition.delete(h)
    },
    showDiagnostics(ds) {
      e.diagnostics.push(ds)
    },
    showCompletions(pos, items) {
      e.completions.push({ pos, items })
    },
    showHover(pos, info) {
      e.hovers.push({ pos, info })
    },
    navigateToDefinition(locs) {
      e.definitions.push(locs)
    },
    emitChange(c) {
      text = c.text
      version = c.version
      for (const h of listeners.change) h(c)
    },
    emitHover(p) {
      for (const h of listeners.hover) h(p)
    },
    emitCompletionRequest(p) {
      for (const h of listeners.completion) h(p)
    },
    emitDefinitionRequest(p) {
      for (const h of listeners.definition) h(p)
    },
    diagnostics: [],
    completions: [],
    hovers: [],
    definitions: [],
  }
  return e
}

// Cast via unknown — the adapter accepts any object that structurally matches
// `LspClient`. Using `unknown` then a narrow cast avoids importing the real
// class into tests.
function mkExt(client: FakeClient): LspExtension {
  return createLspExtension({
    // biome-ignore lint/suspicious/noExplicitAny: test shim for LspClient
    client: client as unknown as any,
  })
}

// ---- tests ------------------------------------------------------------------

describe("createLspExtension", () => {
  let client: FakeClient
  let editor: FakeEditor

  beforeEach(() => {
    client = makeClient()
    editor = makeEditor()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("sends textDocument/didOpen on attach", () => {
    const ext = mkExt(client)
    ext.attach(editor)
    const open = client.notifications.find((n) => n.method === "textDocument/didOpen")
    expect(open).toBeTruthy()
    const params = open?.params as { textDocument: { uri: string; languageId: string } }
    expect(params.textDocument.uri).toBe(editor.uri)
    expect(params.textDocument.languageId).toBe("typescript")
  })

  it("debounces textDocument/didChange at 150ms", () => {
    const ext = mkExt(client)
    ext.attach(editor)
    editor.emitChange({ text: "a", version: 2 })
    editor.emitChange({ text: "ab", version: 3 })
    editor.emitChange({ text: "abc", version: 4 })

    // No didChange yet — timer hasn't fired.
    expect(client.notifications.filter((n) => n.method === "textDocument/didChange")).toHaveLength(
      0,
    )
    expect(ext.hasPendingChange()).toBe(true)

    vi.advanceTimersByTime(150)
    const changes = client.notifications.filter((n) => n.method === "textDocument/didChange")
    expect(changes).toHaveLength(1)
    const p = changes[0].params as {
      textDocument: { version: number }
      contentChanges: Array<{ text: string }>
    }
    expect(p.textDocument.version).toBe(4)
    expect(p.contentChanges[0].text).toBe("abc")
  })

  it("routes textDocument/publishDiagnostics → editor.showDiagnostics", () => {
    const ext = mkExt(client)
    ext.attach(editor)
    const h = client.notificationHandlers.get("textDocument/publishDiagnostics")
    expect(h).toBeTruthy()
    h?.({
      uri: editor.uri,
      diagnostics: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, message: "x" }],
    })
    expect(editor.diagnostics).toHaveLength(1)
    expect(editor.diagnostics[0][0].message).toBe("x")
  })

  it("ignores diagnostics for a different uri", () => {
    const ext = mkExt(client)
    ext.attach(editor)
    const h = client.notificationHandlers.get("textDocument/publishDiagnostics")
    h?.({
      uri: "file:///other.ts",
      diagnostics: [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, message: "x" }],
    })
    expect(editor.diagnostics).toHaveLength(0)
  })

  it("sends completion request and shows items", async () => {
    const client2 = makeClient()
    client2.nextRequestResult = { items: [{ label: "foo" }, { label: "bar" }] }
    const ext = mkExt(client2)
    ext.attach(editor)
    editor.emitCompletionRequest({ line: 1, character: 2 })
    await vi.runAllTimersAsync()
    const req = client2.requests.find((r) => r.method === "textDocument/completion")
    expect(req).toBeTruthy()
    expect(editor.completions).toHaveLength(1)
    expect(editor.completions[0].items.map((i) => i.label)).toEqual(["foo", "bar"])
  })

  it("handles completion error by showing empty array", async () => {
    const client2 = makeClient()
    client2.nextRequestError = new Error("boom")
    const ext = mkExt(client2)
    ext.attach(editor)
    editor.emitCompletionRequest({ line: 1, character: 2 })
    await vi.runAllTimersAsync()
    expect(editor.completions).toHaveLength(1)
    expect(editor.completions[0].items).toEqual([])
  })

  it("sends hover request and shows info", async () => {
    const client2 = makeClient()
    client2.nextRequestResult = { contents: "docstring" }
    const ext = mkExt(client2)
    ext.attach(editor)
    editor.emitHover({ line: 1, character: 2 })
    await vi.runAllTimersAsync()
    expect(editor.hovers).toHaveLength(1)
    expect(editor.hovers[0].info?.contents).toBe("docstring")
  })

  it("sends definition request and navigates", async () => {
    const client2 = makeClient()
    client2.nextRequestResult = {
      uri: "file:///other.ts",
      range: { start: { line: 10, character: 0 }, end: { line: 10, character: 5 } },
    }
    const ext = mkExt(client2)
    ext.attach(editor)
    editor.emitDefinitionRequest({ line: 1, character: 2 })
    await vi.runAllTimersAsync()
    expect(editor.definitions).toHaveLength(1)
    expect(editor.definitions[0][0].uri).toBe("file:///other.ts")
  })

  it("skips hover when server lacks hoverProvider capability", async () => {
    const client2 = makeClient({ capabilities: {} })
    const ext = mkExt(client2)
    ext.attach(editor)
    editor.emitHover({ line: 0, character: 0 })
    await vi.runAllTimersAsync()
    expect(client2.requests.filter((r) => r.method === "textDocument/hover")).toHaveLength(0)
  })

  it("sends textDocument/didClose on detach", () => {
    const ext = mkExt(client)
    ext.attach(editor)
    ext.detach()
    const close = client.notifications.find((n) => n.method === "textDocument/didClose")
    expect(close).toBeTruthy()
    expect(ext.editor).toBeNull()
  })

  it("clears pending change timer on detach", () => {
    const ext = mkExt(client)
    ext.attach(editor)
    editor.emitChange({ text: "ab", version: 2 })
    expect(ext.hasPendingChange()).toBe(true)
    ext.detach()
    expect(ext.hasPendingChange()).toBe(false)
    vi.advanceTimersByTime(500)
    // No didChange should fire after detach
    expect(
      client.notifications.filter((n) => n.method === "textDocument/didChange"),
    ).toHaveLength(0)
  })

  it("offline mode: when client.state is stopped, no messages are sent", () => {
    const client2 = makeClient({ state: "stopped" })
    const ext = mkExt(client2)
    ext.attach(editor)
    editor.emitChange({ text: "x", version: 2 })
    editor.emitHover({ line: 0, character: 0 })
    editor.emitCompletionRequest({ line: 0, character: 0 })
    editor.emitDefinitionRequest({ line: 0, character: 0 })
    vi.advanceTimersByTime(500)
    expect(client2.notifications).toEqual([])
    expect(client2.requests).toEqual([])
    // Editor still works — it can be detached cleanly.
    ext.detach()
  })

  it("detach while stopped does not send didClose", () => {
    const client2 = makeClient({ state: "stopped" })
    const ext = mkExt(client2)
    ext.attach(editor)
    ext.detach()
    expect(client2.notifications.filter((n) => n.method === "textDocument/didClose")).toHaveLength(
      0,
    )
  })

  it("re-attaching detaches the previous editor first", () => {
    const ext = mkExt(client)
    const a = makeEditor("file:///a.ts")
    const b = makeEditor("file:///b.ts")
    ext.attach(a)
    ext.attach(b)
    const closes = client.notifications.filter((n) => n.method === "textDocument/didClose")
    expect(closes).toHaveLength(1)
    expect((closes[0].params as { textDocument: { uri: string } }).textDocument.uri).toBe(
      "file:///a.ts",
    )
    expect(ext.editor?.uri).toBe("file:///b.ts")
  })
})

describe("normalize helpers", () => {
  it("normalizeCompletion handles array, {items}, and nullish", () => {
    expect(normalizeCompletion(null)).toEqual([])
    expect(normalizeCompletion([{ label: "x" }])).toEqual([{ label: "x" }])
    expect(normalizeCompletion({ items: [{ label: "y" }] })).toEqual([{ label: "y" }])
    expect(normalizeCompletion({})).toEqual([])
  })

  it("normalizeHover handles string | MarkupContent | array | null", () => {
    expect(normalizeHover(null)).toBeNull()
    expect(normalizeHover({ contents: "hi" })?.contents).toBe("hi")
    expect(normalizeHover({ contents: { value: "md hi" } })?.contents).toBe("md hi")
    expect(normalizeHover({ contents: [{ value: "a" }, "b"] })?.contents).toBe("a\n\nb")
    expect(normalizeHover({ contents: "" })).toBeNull()
  })

  it("normalizeDefinition handles array, single location, and null", () => {
    expect(normalizeDefinition(null)).toEqual([])
    const loc = {
      uri: "file:///x",
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    }
    expect(normalizeDefinition(loc)).toEqual([loc])
    expect(normalizeDefinition([loc])).toEqual([loc])
  })
})
