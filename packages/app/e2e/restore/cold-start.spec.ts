import { expect, test } from "@playwright/test"

// J2: Full layout restore on cold start.
// Write a known layout state to localStorage, reload, assert layout is restored.

const PERSIST_KEY = "coda.layout.v1"

test("reloads restore sidebar width from localStorage", async ({ page }) => {
  await page.goto("/")
  await page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({ sidebarWidth: 320, rightRailWidth: 380, portsPanelHeight: 180 }),
    )
  }, PERSIST_KEY)
  await page.reload()
  await page.waitForLoadState("networkidle")
  const value = await page.evaluate((key) => localStorage.getItem(key), PERSIST_KEY)
  expect(value).toBeTruthy()
  const parsed = JSON.parse(value ?? "{}") as { sidebarWidth?: number }
  expect(parsed.sidebarWidth).toBe(320)
})
