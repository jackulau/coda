import { describe, expect, test } from "bun:test"
import { type AriaNode, levelOf, roleOf, serializeSnapshot } from "./aria-snapshot"
import { type SelectorNode, generateSelector, scoreCandidates } from "./selector"

const button = (name: string): AriaNode => ({ tag: "button", name, children: [] })

describe("roleOf", () => {
  test("button → button", () => {
    expect(roleOf({ tag: "button", children: [] })).toBe("button")
  })
  test("a → link", () => {
    expect(roleOf({ tag: "a", children: [] })).toBe("link")
  })
  test("h2 → heading", () => {
    expect(roleOf({ tag: "h2", children: [] })).toBe("heading")
  })
  test("explicit role wins over tag", () => {
    expect(roleOf({ tag: "div", role: "button", children: [] })).toBe("button")
  })
})

describe("levelOf", () => {
  test("h3 → 3", () => {
    expect(levelOf({ tag: "h3", children: [] })).toBe(3)
  })
  test("aria-level overrides tag", () => {
    expect(levelOf({ tag: "h1", ariaLevel: 5, children: [] })).toBe(5)
  })
})

describe("serializeSnapshot", () => {
  test("button with name emits ref id", () => {
    const { text, refs } = serializeSnapshot(button("Submit"))
    expect(text).toContain(`button "Submit"`)
    expect(text).toContain("[ref=e1]")
    expect(refs).toHaveLength(1)
  })

  test("aria-hidden excluded", () => {
    const root: AriaNode = {
      tag: "div",
      ariaHidden: true,
      children: [button("Hidden")],
    }
    const { text } = serializeSnapshot(root)
    expect(text).toBe("")
  })

  test("role=presentation excluded", () => {
    const root: AriaNode = {
      tag: "div",
      role: "presentation",
      children: [button("Buried")],
    }
    expect(serializeSnapshot(root).text).toBe("")
  })

  test("heading level captured", () => {
    const root: AriaNode = { tag: "h2", name: "Title", children: [] }
    const { text } = serializeSnapshot(root)
    expect(text).toContain("[level=2]")
  })

  test("checkbox shows state", () => {
    const cb: AriaNode = { tag: "input", role: "checkbox", checked: true, children: [] }
    expect(serializeSnapshot(cb).text).toContain("[checked]")
  })

  test("nested nav shows indentation", () => {
    const nav: AriaNode = {
      tag: "nav",
      children: [
        {
          tag: "ul",
          children: [{ tag: "li", children: [{ tag: "a", name: "Home", children: [] }] }],
        },
      ],
    }
    const { text } = serializeSnapshot(nav)
    expect(text.split("\n").length).toBeGreaterThan(2)
  })

  test("max depth respected", () => {
    let leaf: AriaNode = { tag: "div", children: [] }
    for (let i = 0; i < 30; i++) leaf = { tag: "div", children: [leaf] }
    const { text } = serializeSnapshot(leaf, { maxDepth: 3 })
    expect(text.split("\n").length).toBeLessThanOrEqual(4)
  })
})

const N = (overrides: Partial<SelectorNode> = {}): SelectorNode => ({
  tag: "div",
  ...overrides,
})

describe("scoreCandidates", () => {
  test("id has lowest penalty (best)", () => {
    const c = scoreCandidates(N({ id: "main" }))
    expect(c[0]).toMatchObject({ kind: "id", penalty: 0 })
  })

  test("id escaped when it contains quotes", () => {
    const c = scoreCandidates(N({ id: `fo"o` }))
    expect(c[0]?.selector).toBe(`#fo\\"o`)
  })

  test("tag fallback always present", () => {
    const c = scoreCandidates(N())
    expect(c.some((e) => e.kind === "tag")).toBe(true)
  })
})

describe("generateSelector", () => {
  test("uses first unique candidate", () => {
    const counts: Record<string, number> = { "#main": 1 }
    const s = generateSelector(N({ id: "main" }), (sel) => counts[sel] ?? 0)
    expect(s).toBe("#main")
  })

  test("falls back to parent chain when nothing unique", () => {
    const parent: SelectorNode = { tag: "section", siblingIndex: 0 }
    const child: SelectorNode = { tag: "div", siblingIndex: 1, parent }
    const s = generateSelector(child, () => 3)
    expect(s).toBe("section:nth-of-type(1) > div:nth-of-type(2)")
  })

  test("respects deadline budget", () => {
    const many: SelectorNode = {
      tag: "div",
      classes: ["a", "b", "c", "d", "e"],
      siblingIndex: 0,
    }
    const s = generateSelector(many, () => 5, 0) // budget 0 — skip all candidates
    expect(s).toBe("div:nth-of-type(1)")
  })
})
