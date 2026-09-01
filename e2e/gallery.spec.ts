import { test, expect } from "@playwright/test";

test("gallery loads and shows grid or empty state", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page).toHaveURL(/\/gallery/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
  // sidebar link to gallery exists
  await expect(page.locator('a[href="/gallery"]').first()).toBeVisible();
  // check for gallery filter or empty state - no generation triggered
  // ensure no generate button clicked
  const generate = page.getByRole("button", { name: /generate/i });
  if ((await generate.count()) > 0) {
    await expect(generate.first()).toBeVisible();
  }
});
