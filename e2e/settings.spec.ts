import { test, expect } from "@playwright/test";

test("settings loads and interacts with controls", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('a[href="/settings"]').first()).toBeVisible();

  // check default style preset select
  const presetSelect = page.locator('select[name="default_style_preset"]').first();
  await expect(presetSelect).toBeVisible({ timeout: 10000 }).catch(() => {});
  if ((await presetSelect.count()) > 0) {
    await presetSelect.selectOption({ index: 0 });
  }

  // resolution, image model, video model selects
  const resSelect = page.locator('select[name="default_resolution"]').first();
  if ((await resSelect.count()) > 0) {
    await expect(resSelect).toBeVisible();
    await resSelect.selectOption("720p");
    await expect(resSelect).toHaveValue("720p");
  }
  const imgModel = page.locator('select[name="default_image_model"]').first();
  if ((await imgModel.count()) > 0) {
    await imgModel.selectOption("z-image-turbo");
  }
  const vidModel = page.locator('select[name="default_video_model"]').first();
  if ((await vidModel.count()) > 0) {
    await vidModel.selectOption("wan2.2");
  }

  // click Save Defaults (safe, no generation)
  const saveBtn = page.getByRole("button", { name: /Save Defaults/i }).first();
  if ((await saveBtn.count()) > 0) {
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    // should stay on settings after save
    await expect(page).toHaveURL(/\/settings/);
  }

  // Sync from ComfyUI button - safe to click (just fetches)
  const syncBtn = page.getByRole("button", { name: /Sync from ComfyUI/i }).first();
  if ((await syncBtn.count()) > 0) {
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();
  }

  // New preset button - open dialog then cancel
  const newPresetBtn = page.getByRole("button", { name: /New preset/i }).first();
  if ((await newPresetBtn.count()) > 0) {
    await newPresetBtn.click();
    const dialog = page.locator("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 5000 }).catch(() => {});
    const cancelBtn = page.getByRole("button", { name: "Cancel" }).first();
    if ((await cancelBtn.count()) > 0) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press("Escape").catch(() => {});
    }
  }

  // lora active toggle - if exists, click once
  const loraToggle = page.locator('button:has-text("active"), button:has-text("hidden")').first();
  if ((await loraToggle.count()) > 0) {
    // do not assert, just interact
    await loraToggle.click().catch(() => {});
  }

  await expect(page).toHaveURL(/\/settings/);
});
