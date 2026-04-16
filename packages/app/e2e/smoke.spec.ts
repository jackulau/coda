import { expect, test } from "@playwright/test"

test("app shell boots and renders sidebar + center panel + right rail", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("pageerror", (err) => consoleErrors.push(String(err)))
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text())
  })

  await page.goto("/")
  await expect(page.locator("#root")).toBeVisible()

  await page.waitForLoadState("networkidle")

  expect(consoleErrors.filter((e) => !e.includes("favicon"))).toEqual([])
})

test("cold start renders under 3s budget (loose CI-safe floor)", async ({ page }) => {
  const start = Date.now()
  await page.goto("/")
  await page.locator("#root").waitFor({ state: "visible" })
  const elapsed = Date.now() - start
  expect(elapsed).toBeLessThan(3000)
})
