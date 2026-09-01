import { test, expect } from "@playwright/test";

test("create image loads and interacts with controls without generating", async ({ page }) => {
  await page.goto("/create/image");
  await expect(page).toHaveURL(/\/create\/image/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Prompt/i).first()).toBeVisible({ timeout: 10000 });

  const promptArea = page.locator('textarea[name="prompt"]').first();
  await expect(promptArea).toBeVisible();
  await promptArea.fill("a cyberpunk street at night, neon reflections");
  await expect(promptArea).toHaveValue(/cyberpunk/);

  const styleGuide = page.locator('textarea[name="style_guide"]').first();
  await styleGuide.fill("warm ochre palette");
  await expect(styleGuide).toHaveValue(/ochre/);

  // image model select
  const imageModel = page.locator('select[name="image_model"]').first();
  await expect(imageModel).toBeVisible();
  await imageModel.selectOption("z-image-turbo");

  // resolution select
  const resolution = page.locator('select[name="resolution"]').first();
  await expect(resolution).toBeVisible();
  await resolution.selectOption("720p");
  await expect(resolution).toHaveValue("720p");

  // batch size slider
  const batchSlider = page.locator('input[name="batch_size"][type="range"]').first();
  if ((await batchSlider.count()) > 0) {
    await expect(batchSlider).toBeVisible();
    await batchSlider.evaluate((el: HTMLInputElement, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, "4");
  }

  // style preset select
  const preset = page.locator('select[name="style_preset"]').first();
  if ((await preset.count()) > 0) {
    await expect(preset).toBeVisible();
    await preset.selectOption({ index: 0 });
  }

  // click Reset (not Generate)
  const resetBtn = page.getByRole("button", { name: "Reset" }).first();
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();
  await expect(promptArea).toHaveValue("");

  // verify lora and action headings
  await expect(page.getByText(/LoRAs/i).first()).toBeVisible();
  await expect(page.getByText(/Action/i).first()).toBeVisible();

  const generateBtn = page.locator('#submit-btn').first();
  await expect(generateBtn).toBeVisible();
  await expect(page).toHaveURL(/\/create\/image/);
});
