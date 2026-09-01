import { test, expect } from "@playwright/test";

test("create image loads and allows prompt input without generating", async ({ page }) => {
  await page.goto("/create/image");
  await expect(page).toHaveURL(/\/create\/image/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

  await expect(page.getByText(/Prompt/i).first()).toBeVisible({ timeout: 10000 });

  const promptArea = page.locator('textarea[name="prompt"], textarea[placeholder*="Describe"]').first();
  if ((await promptArea.count()) > 0) {
    await promptArea.fill("a cyberpunk street at night, neon reflections");
    await expect(promptArea).toHaveValue(/cyberpunk/);
    await promptArea.fill("");
  }

  // check style guide textarea interactable
  const styleGuide = page.locator('textarea[name="style_guide"]').first();
  if ((await styleGuide.count()) > 0) {
    await styleGuide.fill("warm ochre palette");
    await expect(styleGuide).toHaveValue(/ochre/);
    await styleGuide.fill("");
  }

  // verify lora/model sections visible
  await expect(page.getByText(/LoRAs/i).first()).toBeVisible();
  await expect(page.getByText(/Action/i).first()).toBeVisible();

  // ensure still on page, no generate clicked
  await expect(page).toHaveURL(/\/create\/image/);
});
