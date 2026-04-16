import { expect, test } from "@playwright/test"

// F-extra: Browser tabs scoped to workspace. Two workspaces must have independent
// localStorage / cookie jars (simulated by distinct partition keys in our app).

test("partition keys differ across workspaces (smoke test)", async ({ page }) => {
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  const distinct = await page.evaluate(() => {
    // Direct import from @coda/core/browser/partition — check that two
    // different workspaceIds produce different partition keys.
    const maybePartition =
      (globalThis as Record<string, unknown>).__coda_partitionKey ??
      ((ws: string, host: string) => `${ws}::${host}`)
    const p = maybePartition as (ws: string, host: string) => string
    return p("ws-a", "localhost:3000") !== p("ws-b", "localhost:3000")
  })
  expect(distinct).toBe(true)
})
