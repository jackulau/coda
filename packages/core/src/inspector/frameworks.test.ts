import { describe, expect, test } from "bun:test"
import { type ElementProbe, detectFramework } from "./frameworks"

const p = (o: Partial<ElementProbe> = {}): ElementProbe => ({
  tag: "div",
  attributes: {},
  ...o,
})

describe("detectFramework", () => {
  test("React first when React instance present", () => {
    const r = detectFramework(p({ hasReactInstance: true }))
    expect(r.framework).toBe("react")
  })

  test("Angular via _ngcontent attribute", () => {
    const r = detectFramework(p({ attributes: { "_ngcontent-a23": "" } }))
    expect(r.framework).toBe("angular")
  })

  test("Angular via ng-version", () => {
    const r = detectFramework(p({ attributes: { "ng-version": "16.2" } }))
    expect(r.framework).toBe("angular")
  })

  test("Lit via properties flag", () => {
    const r = detectFramework(p({ hasLitProperties: true }))
    expect(r.framework).toBe("lit")
  })

  test("custom element with hyphen → web-component", () => {
    const r = detectFramework(p({ tag: "my-widget" }))
    expect(r.framework).toBe("web-component")
    expect(r.name).toBe("my-widget")
  })

  test("data-testid fallback for vanilla", () => {
    const r = detectFramework(p({ attributes: { "data-testid": "submit-btn" } }))
    expect(r.framework).toBe("vanilla")
    expect(r.name).toBe("submit-btn")
  })

  test("role attribute as last resort for vanilla", () => {
    const r = detectFramework(p({ attributes: { role: "dialog" } }))
    expect(r.framework).toBe("vanilla")
    expect(r.name).toBe("dialog")
  })

  test("no markers → unknown", () => {
    const r = detectFramework(p())
    expect(r.framework).toBe("unknown")
  })

  test("React + Angular — React wins by priority", () => {
    const r = detectFramework(p({ hasReactInstance: true, attributes: { "ng-version": "1.0" } }))
    expect(r.framework).toBe("react")
  })
})
