import { expect, test } from "@playwright/test"
import { installFakeTauri } from "./fixtures/tmp-workspace"

test("empty workspace CTA is visible on first launch", async ({ page }) => {
  await installFakeTauri(page, {
    dirs: {},
    files: {},
    workspaces: [],
    lastSelectedId: null,
  })
  await page.goto("/")
  await expect(page.getByTestId("sidebar-empty-cta")).toBeVisible()
})

test("tab key reaches primary controls without getting stuck", async ({ page }) => {
  await installFakeTauri(page, {
    dirs: {},
    files: {},
    workspaces: [],
    lastSelectedId: null,
  })
  await page.goto("/")
  await expect(page.getByTestId("sidebar-empty-cta")).toBeVisible()

  let reachedButton = false
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab")
    const focused = await page.evaluate(() => document.activeElement?.tagName ?? "")
    if (focused === "BUTTON") {
      reachedButton = true
      break
    }
  }
  expect(reachedButton).toBe(true)
})

test("reduced-motion zeroes the coda-skeleton-row animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await installFakeTauri(page, {
    dirs: {},
    files: {},
    workspaces: [],
    lastSelectedId: null,
  })
  await page.goto("/")
  await page.waitForLoadState("networkidle")
  // Inject a probe element to read the .coda-skeleton-row computed style
  // without relying on the component having mounted a skeleton instance.
  const animation = await page.evaluate(() => {
    const div = document.createElement("div")
    div.className = "coda-skeleton-row"
    document.body.appendChild(div)
    const v = getComputedStyle(div).animationDuration
    document.body.removeChild(div)
    return v
  })
  expect(animation).toBe("0s")
})

test("file tree renders error row when a subdirectory listing fails", async ({ page }) => {
  await installFakeTauri(page, {
    dirs: {
      "/w": [{ name: "denied", path: "/w/denied", kind: "directory" }],
      // intentionally no /w/denied entry -> the mock will reject
    },
    files: {},
    workspaces: [{ id: "id-1", name: "w", rootPath: "/w" }],
    lastSelectedId: "id-1",
  })
  await page.goto("/")
  const denied = page.getByTestId("file-tree-row-/w/denied")
  await expect(denied).toBeVisible()
  await denied.click()
  await expect(page.locator("[data-error='true']").first()).toBeVisible()
})
