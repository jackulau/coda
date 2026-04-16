import { expect, test } from "@playwright/test"

// J3: Performance budgets — loose CI floor.
const PERF_SCALE = Number.parseFloat(process.env.PERF_SCALE_FACTOR ?? "1")

test("cold start under 3 seconds (×PERF_SCALE)", async ({ page }) => {
  const start = Date.now()
  await page.goto("/")
  await page.locator("#root").waitFor({ state: "visible" })
  const elapsed = Date.now() - start
  expect(elapsed).toBeLessThan(3000 * PERF_SCALE)
})

test("sidebar renders within 1.5s of navigation (×PERF_SCALE)", async ({ page }) => {
  const start = Date.now()
  await page.goto("/")
  const sidebar = page.locator("[data-testid='sidebar']").first()
  await sidebar.waitFor({ state: "visible", timeout: 3000 * PERF_SCALE })
  const elapsed = Date.now() - start
  expect(elapsed).toBeLessThan(1500 * PERF_SCALE)
})
