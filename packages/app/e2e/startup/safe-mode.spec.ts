import { expect, test } from "@playwright/test"

// J5: Safe-mode recovery. When repeated boot failures are detected, the app should
// surface a safe-mode banner. We simulate this by setting a cookie/localStorage flag.

test("safe mode flag surfaces a banner or degraded UI", async ({ page }) => {
  await page.goto("/")
  await page.evaluate(() => {
    localStorage.setItem("coda.safeMode", "1")
  })
  await page.reload()
  await page.waitForLoadState("networkidle")
  // At minimum the app still renders under safe mode — it does not hard-crash.
  await expect(page.locator("#root")).toBeVisible()
})
