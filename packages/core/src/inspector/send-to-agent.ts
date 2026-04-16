export interface InspectedElement {
  tag: string
  classes?: string[]
  selector: string
  framework?: "react" | "vue" | "svelte" | "angular" | "lit" | "web-component" | "vanilla"
  componentName?: string
  sourceFile?: string
  sourceLine?: number
  htmlPreview?: string
  cssAuthored?: Record<string, string>
}

export interface FormatOptions {
  maxInstructionChars?: number
}

export interface FormatResult {
  message: string
  truncatedInstruction: boolean
}

export function formatElementMessage(
  element: InspectedElement,
  instruction: string,
  opts: FormatOptions = {},
): FormatResult {
  const lines: string[] = []
  const max = opts.maxInstructionChars ?? 4000
  lines.push("Selected element:")
  lines.push(`- tag: <${element.tag.toLowerCase()}>`)
  if (element.classes?.length) lines.push(`- classes: ${element.classes.join(" ")}`)
  lines.push(`- selector: \`${element.selector}\``)
  if (element.framework) {
    const fw = element.componentName
      ? `${element.framework}: ${element.componentName}`
      : element.framework
    lines.push(`- framework: ${fw}`)
  }
  if (element.sourceFile) {
    const loc = element.sourceLine ? `:${element.sourceLine}` : ""
    lines.push(`- source: ${element.sourceFile}${loc}`)
  }
  if (element.cssAuthored && Object.keys(element.cssAuthored).length > 0) {
    const entries = Object.entries(element.cssAuthored)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ")
    lines.push(`- css: ${entries}`)
  }
  if (element.htmlPreview) {
    lines.push("```html")
    lines.push(element.htmlPreview.trim())
    lines.push("```")
  }
  const trimmed = instruction.trim()
  const truncated = trimmed.length > max
  const body = truncated ? `${trimmed.slice(0, max)} …[truncated]` : trimmed
  if (body) {
    lines.push("")
    lines.push(`Instruction: ${body}`)
  }
  return { message: lines.join("\n"), truncatedInstruction: truncated }
}

export function formatBatchMessage(elements: InspectedElement[], instruction: string): string {
  const parts = elements.map(
    (e, i) => `### Element ${i + 1}\n${formatElementMessage(e, "").message}`,
  )
  const body = parts.join("\n\n")
  const trimmed = instruction.trim()
  return trimmed ? `${body}\n\nInstruction: ${trimmed}` : body
}

export interface TerminalHandle {
  id: string
  name: string
  lastActiveAt: number
  agentActive: boolean
}

export function selectTargetTerminal(
  terminals: TerminalHandle[],
  preferredId?: string,
): TerminalHandle | null {
  if (preferredId) {
    const pref = terminals.find((t) => t.id === preferredId)
    if (pref) return pref
  }
  const active = terminals.filter((t) => t.agentActive)
  if (active.length > 0) {
    active.sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    return active[0] ?? null
  }
  return null
}
