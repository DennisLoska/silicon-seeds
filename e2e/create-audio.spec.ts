import { test, expect } from "@playwright/test";

test("create audio loads and allows prompt input without generating", async ({ page }) => {
  await page.goto("/create/audio");
  await expect(page).toHaveURL(/\/create\/audio/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

  await expect(page.getByText(/Prompts/i).first()).toBeVisible({ timeout: 10000 });

  const instrumental = page.locator('textarea[name="instrumental_prompt"]').first();
  if ((await instrumental.count()) > 0) {
    await instrumental.fill("slow ambient pop with piano");
    await expect(instrumental).toHaveValue(/ambient/);
    await instrumental.fill("");
  }

  const lyric = page.locator('textarea[name="lyric_prompt"], #lyric_prompt').first();
  if ((await lyric.count()) > 0) {
    await lyric.fill("a short hook about sunrise");
    await expect(lyric).toHaveValue(/sunrise/);
    await lyric.fill("");
  }

  // check generation controls visible but not pressed
  await expect(page.getByText(/Generate Audio/i).first()).toBeVisible();
  const generateBtn = page.getByRole("button", { name: /generate/i }).first();
  await expect(generateBtn).toBeVisible();
  // explicitly do not click

  await expect(page).toHaveURL(/\/create\/audio/);
});
