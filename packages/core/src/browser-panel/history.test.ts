import { describe, expect, test } from "bun:test"
import { BrowserHistory, TabNavStack, normalizeUrl } from "./history"

describe("normalizeUrl", () => {
  test("empty string → empty error", () => {
    expect(normalizeUrl("")).toEqual({ ok: false, kind: "empty" })
  })

  test("bare host → defaults to https", () => {
    const r = normalizeUrl("example.com")
    expect(r.ok).toBe(true)
    expect(r.normalized).toBe("https://example.com/")
  })

  test("http:// accepted", () => {
    expect(normalizeUrl("http://localhost:3000").ok).toBe(true)
  })

  test("file:// blocked", () => {
    const r = normalizeUrl("file:///etc/passwd")
    expect(r.ok).toBe(false)
    expect(r.kind).toBe("blocked-scheme")
  })

  test("javascript: blocked", () => {
    expect(normalizeUrl("javascript:alert(1)").kind).toBe("blocked-scheme")
  })

  test("nonsense → invalid-url", () => {
    const r = normalizeUrl("http://[[[")
    expect(r.ok).toBe(false)
  })
})

describe("BrowserHistory", () => {
  test("visit creates entry with count 1", () => {
    const h = new BrowserHistory()
    const e = h.visit("https://a.com/", "A", 1)
    expect(e.visitCount).toBe(1)
  })

  test("revisit increments count, updates title + ts", () => {
    const h = new BrowserHistory()
    h.visit("https://a.com/", "A", 1)
    const e = h.visit("https://a.com/", "A2", 2)
    expect(e.visitCount).toBe(2)
    expect(e.title).toBe("A2")
    expect(e.visitedAt).toBe(2)
  })

  test("autocomplete by url substring ranks by visitCount then recency", () => {
    const h = new BrowserHistory()
    h.visit("https://foo.com/a", "Foo A", 1)
    h.visit("https://foo.com/b", "Foo B", 2)
    h.visit("https://foo.com/b", "Foo B", 3)
    const out = h.autocomplete("foo")
    expect(out[0]?.url).toBe("https://foo.com/b")
  })

  test("autocomplete matches title too", () => {
    const h = new BrowserHistory()
    h.visit("https://a.com/", "GitHub — coda", 1)
    const out = h.autocomplete("github")
    expect(out[0]?.url).toBe("https://a.com/")
  })

  test("cap evicts oldest URL beyond limit", () => {
    const h = new BrowserHistory(2)
    h.visit("https://a.com/", "A", 1)
    h.visit("https://b.com/", "B", 2)
    h.visit("https://c.com/", "C", 3)
    expect(h.size()).toBe(2)
    expect(h.autocomplete("a.com")).toEqual([])
  })
})

describe("TabNavStack", () => {
  test("navigate clears forward stack", () => {
    const s = new TabNavStack()
    s.navigate({ url: "a", title: "" })
    s.navigate({ url: "b", title: "" })
    s.goBack()
    expect(s.canGoForward()).toBe(true)
    s.navigate({ url: "c", title: "" })
    expect(s.canGoForward()).toBe(false)
  })

  test("back/forward round-trip", () => {
    const s = new TabNavStack()
    s.navigate({ url: "a", title: "" })
    s.navigate({ url: "b", title: "" })
    expect(s.goBack()?.url).toBe("a")
    expect(s.goForward()?.url).toBe("b")
  })

  test("goBack on empty → null", () => {
    const s = new TabNavStack()
    expect(s.goBack()).toBeNull()
  })

  test("initial: canGoBack/Forward both false", () => {
    const s = new TabNavStack()
    expect(s.canGoBack()).toBe(false)
    expect(s.canGoForward()).toBe(false)
  })
})
