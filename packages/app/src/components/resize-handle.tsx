import { type Component, createSignal, onCleanup } from "solid-js"

export type ResizeDirection = "horizontal" | "vertical"

export interface ResizeHandleProps {
  /**
   * Direction of the drag. "horizontal" = user drags left/right, so this
   * handle is a vertical 1px bar (think sidebar edge). "vertical" = user drags
   * up/down, so the handle is a horizontal 1px bar (think bottom dock top).
   */
  direction: ResizeDirection
  /**
   * Called on each pointer move while dragging. delta is in CSS pixels,
   * positive for right/down, negative for left/up.
   */
  onDrag: (deltaPx: number) => void
  onDragEnd?: () => void
  /** Invoked on keyboard arrow keys. delta is in CSS pixels (signed). */
  onNudge?: (deltaPx: number) => void
  ariaLabel: string
  /** Flip the visual side of the hit area (e.g. right rail wants the handle on its left edge). */
  side?: "near" | "far"
  /** Test id for automation. */
  testId?: string
}

const NUDGE_STEP = 8
const NUDGE_STEP_LARGE = 32

export const ResizeHandle: Component<ResizeHandleProps> = (props) => {
  const [dragging, setDragging] = createSignal(false)
  let rafId: number | null = null
  let pending: number | null = null

  const flushDelta = () => {
    rafId = null
    if (pending === null) return
    const delta = pending
    pending = null
    props.onDrag(delta)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    setDragging(true)
    const start = props.direction === "horizontal" ? e.clientX : e.clientY
    let last = start

    const onMove = (ev: PointerEvent) => {
      const now = props.direction === "horizontal" ? ev.clientX : ev.clientY
      const d = now - last
      last = now
      if (d === 0) return
      pending = (pending ?? 0) + d
      if (rafId == null) rafId = requestAnimationFrame(flushDelta)
    }

    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId)
      target.removeEventListener("pointermove", onMove)
      target.removeEventListener("pointerup", onUp)
      target.removeEventListener("pointercancel", onUp)
      if (rafId != null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (pending !== null) {
        const d = pending
        pending = null
        props.onDrag(d)
      }
      setDragging(false)
      props.onDragEnd?.()
    }

    target.addEventListener("pointermove", onMove)
    target.addEventListener("pointerup", onUp)
    target.addEventListener("pointercancel", onUp)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const h = props.direction === "horizontal"
    const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP
    let delta = 0
    if (h && e.key === "ArrowLeft") delta = -step
    else if (h && e.key === "ArrowRight") delta = step
    else if (!h && e.key === "ArrowUp") delta = -step
    else if (!h && e.key === "ArrowDown") delta = step
    else return
    e.preventDefault()
    ;(props.onNudge ?? props.onDrag)(delta)
  }

  onCleanup(() => {
    if (rafId != null) cancelAnimationFrame(rafId)
  })

  const isH = () => props.direction === "horizontal"

  return (
    <div
      // biome-ignore lint/a11y/useSemanticElements: a draggable splitter cannot be <hr> (which is self-closing and non-interactive); div[role=separator] is the ARIA-correct pattern for an interactive resizer.
      role="separator"
      aria-orientation={isH() ? "vertical" : "horizontal"}
      aria-label={props.ariaLabel}
      tabIndex={0}
      data-testid={props.testId}
      data-dragging={dragging() ? "true" : "false"}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      class="coda-resize-handle"
      style={{
        position: "relative",
        "flex-shrink": 0,
        cursor: isH() ? "ew-resize" : "ns-resize",
        width: isH() ? "6px" : "100%",
        height: isH() ? "100%" : "6px",
        "margin-left": isH() && props.side !== "far" ? "-3px" : undefined,
        "margin-right": isH() && props.side === "far" ? "-3px" : undefined,
        "margin-top": !isH() && props.side !== "far" ? "-3px" : undefined,
        "margin-bottom": !isH() && props.side === "far" ? "-3px" : undefined,
        "z-index": 2,
        "background-color": dragging() ? "var(--accent-500)" : "transparent",
        transition: "background-color var(--motion-fast)",
        "user-select": "none",
        "touch-action": "none",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
      }}
      onMouseEnter={(e) => {
        if (dragging()) return
        ;(e.currentTarget as HTMLElement).style.backgroundColor = "var(--border-emphasis)"
      }}
      onMouseLeave={(e) => {
        if (dragging()) return
        ;(e.currentTarget as HTMLElement).style.backgroundColor = "transparent"
      }}
      onFocus={(e) => {
        ;(e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-500)"
      }}
      onBlur={(e) => {
        if (dragging()) return
        ;(e.currentTarget as HTMLElement).style.backgroundColor = "transparent"
      }}
    >
      <span
        aria-hidden="true"
        class="coda-resize-grip"
        style={{
          display: "inline-block",
          width: isH() ? "2px" : "22px",
          height: isH() ? "22px" : "2px",
          "border-radius": "1px",
          "background-color": "var(--text-tertiary)",
          opacity: 0,
          transition: "opacity var(--motion-fast)",
          "pointer-events": "none",
        }}
      />
    </div>
  )
}
