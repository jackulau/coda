export interface ElementProbe {
  tag: string
  attributes: Record<string, string>
  hasReactInstance?: boolean
  hasVueInstance?: boolean
  hasSvelteInstance?: boolean
  hasAngularContext?: boolean
  hasLitProperties?: boolean
}

export interface FrameworkDetection {
  framework:
    | "react"
    | "vue"
    | "svelte"
    | "angular"
    | "web-component"
    | "lit"
    | "vanilla"
    | "unknown"
  confidence: number
  name?: string
}

export function detectAngular(p: ElementProbe): FrameworkDetection | null {
  if (p.hasAngularContext) return { framework: "angular", confidence: 0.95 }
  if (Object.keys(p.attributes).some((k) => k.startsWith("_ngcontent-"))) {
    return { framework: "angular", confidence: 0.9 }
  }
  if (p.attributes["ng-version"]) return { framework: "angular", confidence: 0.9 }
  return null
}

export function detectLit(p: ElementProbe): FrameworkDetection | null {
  if (p.hasLitProperties) return { framework: "lit", confidence: 0.9 }
  return null
}

export function detectWebComponent(p: ElementProbe): FrameworkDetection | null {
  if (p.tag.includes("-"))
    return { framework: "web-component", confidence: 0.7, name: p.tag.toLowerCase() }
  return null
}

export function detectGenericVanilla(p: ElementProbe): FrameworkDetection | null {
  if (p.attributes["data-testid"]) {
    return {
      framework: "vanilla",
      confidence: 0.5,
      name: p.attributes["data-testid"],
    }
  }
  if (p.attributes["data-component"]) {
    return {
      framework: "vanilla",
      confidence: 0.5,
      name: p.attributes["data-component"],
    }
  }
  if (p.attributes.role) {
    return { framework: "vanilla", confidence: 0.4, name: p.attributes.role }
  }
  return null
}

export function detectFramework(p: ElementProbe): FrameworkDetection {
  if (p.hasReactInstance) return { framework: "react", confidence: 0.95 }
  if (p.hasVueInstance) return { framework: "vue", confidence: 0.95 }
  if (p.hasSvelteInstance) return { framework: "svelte", confidence: 0.95 }
  return (
    detectAngular(p) ??
    detectLit(p) ??
    detectWebComponent(p) ??
    detectGenericVanilla(p) ?? { framework: "unknown", confidence: 0 }
  )
}
