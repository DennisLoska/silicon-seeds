import { test, expect } from "@playwright/test";

test("compose loads and allows typing without generating", async ({ page }) => {
  await page.goto("/compose");
  await expect(page).toHaveURL(/\/compose/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

  // check for compose specific headings
  const videoScript = page.getByText(/Video Script/i).first();
  await expect(videoScript).toBeVisible({ timeout: 10000 });

  const styleGuide = page.getByText(/Style Guide/i).first();
  await expect(styleGuide).toBeVisible();

  // interact with textarea without submitting
  const textareas = page.locator("textarea");
  if ((await textareas.count()) > 0) {
    const first = textareas.first();
    await first.fill("a serene mountain landscape at dawn");
    await expect(first).toHaveValue(/mountain/);
    // clear to leave clean
    await first.fill("");
  }

  // ensure generate/action area visible but not clicked
  const actionHeading = page.getByText(/Action/i).first();
  if ((await actionHeading.count()) > 0) {
    await expect(actionHeading).toBeVisible();
  }
  // verify we didn't submit: still on compose
  await expect(page).toHaveURL(/\/compose/);
});
