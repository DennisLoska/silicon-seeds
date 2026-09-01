import { test, expect } from "@playwright/test";

test("gallery loads and interacts with filter radios and grid", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page).toHaveURL(/\/gallery/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading", { name: "Gallery" }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('a[href="/gallery"]').first()).toBeVisible();

  // interact with filter radios: All, Images, Videos, Audio
  const allRadio = page.locator('input[value="all"][name="gallery-type"]');
  const imageRadio = page.locator('input[value="image"][name="gallery-type"]');
  const videoRadio = page.locator('input[value="video"][name="gallery-type"]');
  const audioRadio = page.locator('input[value="audio"][name="gallery-type"]');

  await expect(allRadio).toBeVisible();
  await allRadio.click();
  await expect(allRadio).toBeChecked();

  await imageRadio.click();
  await expect(imageRadio).toBeChecked();
  await expect(page.locator("#gallery-grid")).toBeVisible();

  await videoRadio.click();
  await expect(videoRadio).toBeChecked();

  await audioRadio.click();
  await expect(audioRadio).toBeChecked();

  // back to All
  await allRadio.click();
  await expect(allRadio).toBeChecked();

  // check sentinel exists (infinite scroll)
  await expect(page.locator("#gallery-sentinel")).toBeVisible();

  // ensure no generate button clicked
  await expect(page).toHaveURL(/\/gallery/);
});
