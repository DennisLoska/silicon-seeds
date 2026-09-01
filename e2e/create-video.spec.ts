import { test, expect } from "@playwright/test";

test("create video loads and allows prompt input without generating", async ({ page }) => {
  await page.goto("/create/video");
  await expect(page).toHaveURL(/\/create\/video/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

  const prompt = page.locator('textarea[name="prompt"], #video-prompt').first();
  if ((await prompt.count()) > 0) {
    await prompt.fill("a serene mountain lake at sunrise, gentle mist");
    await expect(prompt).toHaveValue(/mountain lake/);
    await prompt.fill("");
  }

  const styleGuide = page.locator('textarea[name="style_guide"], #style-guide').first();
  if ((await styleGuide.count()) > 0) {
    await styleGuide.fill("warm ochre palette, watercolor");
    await expect(styleGuide).toHaveValue(/ochre/);
    await styleGuide.fill("");
  }

  // check generate video section visible but not clicked
  const generateHeading = page.getByText(/Generate Video/i).first();
  if ((await generateHeading.count()) > 0) {
    await expect(generateHeading).toBeVisible();
  }
  const generateBtn = page.getByRole("button", { name: /generate video/i }).first();
  if ((await generateBtn.count()) > 0) {
    await expect(generateBtn).toBeVisible();
  }

  await expect(page).toHaveURL(/\/create\/video/);
});
