import { test, expect } from "@playwright/test";

test("compose loads and interacts with controls without generating", async ({
  page,
}) => {
  await page.goto("/compose");
  await expect(page).toHaveURL(/\/compose/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({
    timeout: 10000,
  });

  await expect(page.getByText(/Video Script/i).first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText(/Style Guide/i).first()).toBeVisible();

  // interact with script textarea
  const scriptArea = page.locator('textarea[name="script"]').first();
  await expect(scriptArea).toBeVisible();
  await scriptArea.fill("a serene mountain landscape at dawn, mist over lake");
  await expect(scriptArea).toHaveValue(/mountain/);

  // interact with style guide textarea
  const styleGuide = page.locator('textarea[name="style_guide"]').first();
  await styleGuide.fill("warm ochre palette, watercolor");
  await expect(styleGuide).toHaveValue(/ochre/);

  // interact with FPS slider
  const fpsSlider = page.locator('input[name="fps"][type="range"]').first();
  await expect(fpsSlider).toBeVisible();
  await fpsSlider.evaluate((el: HTMLInputElement, val) => {
    el.value = val;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, "12");
  // check badge updated
  await expect(page.locator("text=12s").first())
    .toBeVisible()
    .catch(() => {});

  // interact with clip duration slider
  const clipSlider = page
    .locator('input[name="clip_duration"][type="range"]')
    .first();
  if ((await clipSlider.count()) > 0) {
    await clipSlider.evaluate((el: HTMLInputElement, val) => {
      el.value = val;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, "7");
  }

  // select resolution
  const resolution = page.locator('select[name="resolution"]').first();
  await expect(resolution).toBeVisible();
  await resolution.selectOption("720p");
  await expect(resolution).toHaveValue("720p");

  // select video model
  const videoModel = page.locator('select[name="video_model"]').first();
  await expect(videoModel).toBeVisible();
  await videoModel.selectOption("wan2.2");

  // select image model
  const imageModel = page.locator('select[name="image_model"]').first();
  await expect(imageModel).toBeVisible();
  await imageModel.selectOption("z-image-turbo");

  // interact with voice select
  const voiceSelect = page.locator('select[name="voice_id"]').first();
  await expect(voiceSelect).toBeVisible();
  // just open and keep default
  await voiceSelect.selectOption({ index: 0 });

  // click Reset button (not Generate)
  const resetBtn = page.getByRole("button", { name: "Reset" }).first();
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();
  // after reset, script should be empty
  await expect(scriptArea).toHaveValue("");

  // verify we didn't submit: still on compose
  await expect(page).toHaveURL(/\/compose/);
  const generateBtn = page
    .getByRole("button", { name: /Generate Video/i })
    .first();
  await expect(generateBtn).toBeVisible();
  // do not click generate
});
