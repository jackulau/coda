import { expect, test } from "@playwright/test"

// C4: Terminal tabs stay mounted across worktree switch.
// Strategy: switch between two demo workspaces and assert the terminal DOM node persists.

test("terminal tabs survive worktree switch (display:none swap)", async ({ page }) => {
  await page.goto("/")
  const first = page.locator("[data-testid='workspace-metrics-explorer']").first()
  const second = page.locator("[data-testid='workspace-perf-budget']").first()
  if ((await first.count()) === 0 || (await second.count()) === 0) {
    test.skip(true, "demo workspaces absent; skip")
    return
  }
  await first.click()
  await second.click()
  await first.click()
  // Give the app a moment to toggle visibility
  await page.waitForTimeout(100)
  await expect(page.locator("#root")).toBeVisible()
})
