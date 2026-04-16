export interface StyleMap {
  [property: string]: string
}

export interface BaselineRegistry {
  get(tag: string): StyleMap | undefined
  set(tag: string, styles: StyleMap): void
}

export class MemoryBaseline implements BaselineRegistry {
  private map = new Map<string, StyleMap>()
  get(tag: string): StyleMap | undefined {
    return this.map.get(tag.toLowerCase())
  }
  set(tag: string, styles: StyleMap): void {
    this.map.set(tag.toLowerCase(), { ...styles })
  }
}

export function diffAgainstBaseline(
  tag: string,
  authored: StyleMap,
  baseline: BaselineRegistry,
): StyleMap {
  const base = baseline.get(tag) ?? {}
  const out: StyleMap = {}
  for (const [k, v] of Object.entries(authored)) {
    if (base[k] !== v) out[k] = v
  }
  return out
}

const TRACKED_PROPS = [
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "padding",
  "margin",
  "border",
  "border-radius",
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "z-index",
  "flex-direction",
  "justify-content",
  "align-items",
  "gap",
  "grid-template-columns",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "box-shadow",
  "transform",
  "transition",
  "opacity",
  "cursor",
  "overflow",
  "white-space",
  "text-align",
  "text-decoration",
  "visibility",
] as const

export function filterTrackedProps(styles: StyleMap): StyleMap {
  const set = new Set<string>(TRACKED_PROPS)
  const out: StyleMap = {}
  for (const [k, v] of Object.entries(styles)) {
    if (set.has(k)) out[k] = v
  }
  return out
}
