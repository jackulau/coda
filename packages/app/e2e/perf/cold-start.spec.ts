// R9: cold start perf budget.
//
// Time from `page.goto("/")` until the sidebar is visible.
// Budget: ≤ 1500ms locally, ≤ 3000ms when CI=1.
// PERF_SCALE_FACTOR multiplies the budget further.

import { expect, test } from "@playwright/test"
import { assertBudget } from "@coda/core/perf/assert-budget"

const CI = process.env.CI === "1" || process.env.CI === "true"
const BASE_BUDGET_MS = CI ? 3000 : 1500

test("@perf cold start until sidebar visible", async ({ page }) => {
  const start = Date.now()
  await page.goto("/")
  const sidebar = page.getByTestId("sidebar").first()
  await sidebar.waitFor({ state: "visible", timeout: 30_000 })
  const elapsed = Date.now() - start
  // assertBudget reads PERF_SCALE_FACTOR from process.env automatically.
  const r = assertBudget("cold-start", [elapsed], BASE_BUDGET_MS, "max")
  expect(r.passed).toBe(true)
  expect(elapsed).toBeLessThan(r.scaledBudgetMs)
})
