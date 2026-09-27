import { test, expect } from "@playwright/test";

test("create text-to-video loads without lora/preset, interacts without generating", async ({ page }) => {
  await page.goto("/create/text-to-video");
  await expect(page).toHaveURL(/\/create\/text-to-video/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

  const prompt = page.locator('textarea[name="prompt"], #video-prompt').first();
  await expect(prompt).toBeVisible();
  await prompt.fill("a serene mountain lake at sunrise, gentle mist");
  await expect(prompt).toHaveValue(/mountain lake/);

  const styleGuide = page.locator('textarea[name="style_guide"], #style-guide').first();
  await expect(styleGuide).toBeVisible();
  await styleGuide.fill("warm ochre palette, watercolor");
  await expect(styleGuide).toHaveValue(/ochre/);

  const videoModel = page.locator('select[name="video_model"]').first();
  await expect(videoModel).toBeVisible();
  await videoModel.selectOption("wan2.2");

  const fps = page.locator('input[name="fps"][type="range"]').first();
  await expect(fps).toBeVisible();
  await fps.evaluate((el: HTMLInputElement, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, "12");

  const clip = page.locator('input[name="clip_duration"][type="range"]').first();
  if ((await clip.count()) > 0) {
    await clip.evaluate((el: HTMLInputElement, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, "5");
  }

  const resolution = page.locator('select[name="resolution"]').first();
  await expect(resolution).toBeVisible();
  await resolution.selectOption("720p");
  await expect(resolution).toHaveValue("720p");

  await expect(page.locator('select[name="style_preset"]')).toHaveCount(0);
  await expect(page.getByText(/Intermediate image \(used for I2V\)/i)).toHaveCount(0);

  const resetBtn = page.getByRole("button", { name: "Reset" }).first();
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();
  await expect(prompt).toHaveValue("");

  const generateHeading = page.getByText(/Generate Video/i).first();
  if ((await generateHeading.count()) > 0) await expect(generateHeading).toBeVisible();

  await expect(page).toHaveURL(/\/create\/text-to-video/);

  const sidebarEntry = page.locator('#sidebar-text-to-video').first();
  await expect(sidebarEntry).toBeVisible();
});
