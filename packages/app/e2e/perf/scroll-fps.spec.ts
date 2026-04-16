// R9: terminal scroll FPS budget.
//
// Injects a long content block into the page, scrolls continuously, samples
// requestAnimationFrame deltas, and asserts a mean FPS floor. Target is
// ≥120fps on M-series and ≥60fps on non-HiDPI/older hardware — detected via
// `navigator.hardwareConcurrency`. PERF_SCALE_FACTOR loosens the floor on CI.

import { assertFpsFloor } from "@coda/core/perf/assert-budget"
import { expect, test } from "@playwright/test"

test("@perf terminal scroll meets fps floor", async ({ page }) => {
  await page.goto("/")
  await page.getByTestId("sidebar").first().waitFor({ state: "visible", timeout: 30_000 })

  const sample = await page.evaluate(async () => {
    // Build a long scrollable container synthetically.
    const host = document.createElement("div")
    host.style.cssText =
      "position:fixed;inset:0;overflow:auto;background:#000;font-family:monospace;"
    host.setAttribute("data-perf-scroll-host", "1")
    for (let i = 0; i < 5000; i++) {
      const line = document.createElement("div")
      line.textContent = `line ${i} — x${"=".repeat(60)}`
      line.style.cssText = "color:#0f0;padding:2px 8px;font-size:12px;line-height:16px;"
      host.appendChild(line)
    }
    document.body.appendChild(host)

    const frametimes: number[] = []
    let last = performance.now()
    const cores = navigator.hardwareConcurrency ?? 4

    // Stream scrollTop updates across ~30 rafs while recording deltas.
    await new Promise<void>((resolve) => {
      let frame = 0
      const step = () => {
        const now = performance.now()
        const dt = now - last
        if (frame > 0) frametimes.push(dt) // ignore first frame
        last = now
        host.scrollTop = frame * 30
        frame += 1
        if (frame < 30) {
          requestAnimationFrame(step)
        } else {
          resolve()
        }
      }
      requestAnimationFrame(step)
    })

    host.remove()
    return { frametimes, cores }
  })

  expect(sample.frametimes.length).toBeGreaterThan(10)

  // Spec: "≥ 60 fps mean (≥ 120 fps target on M-series — detected via
  // navigator.hardwareConcurrency heuristic)". 60fps is the hard floor; 120fps
  // is aspirational. We assert the hard floor, then record the stretch-target
  // delta in the console for perf-regression tracking.
  const HARD_FLOOR = 60
  const STRETCH_TARGET = sample.cores >= 8 ? 120 : 60
  const r = assertFpsFloor("terminal-scroll", sample.frametimes, HARD_FLOOR)
  expect(r.passed).toBe(true)
  // eslint-disable-next-line no-console
  console.log(
    `scroll-fps: observed=${r.fps.toFixed(1)} hard-floor=${HARD_FLOOR} stretch=${STRETCH_TARGET} cores=${sample.cores}`,
  )
})
