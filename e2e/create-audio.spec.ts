import { test, expect } from "@playwright/test";

test("create audio loads and interacts with controls without generating", async ({ page }) => {
  await page.goto("/create/audio");
  await expect(page).toHaveURL(/\/create\/audio/);
  await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Prompts/i).first()).toBeVisible({ timeout: 10000 });

  const instrumental = page.locator('textarea[name="instrumental_prompt"]').first();
  await expect(instrumental).toBeVisible();
  await instrumental.fill("slow ambient pop with piano, glassy synths");
  await expect(instrumental).toHaveValue(/ambient/);

  const lyric = page.locator('textarea[name="lyric_prompt"]').first();
  await expect(lyric).toBeVisible();
  await lyric.fill("a short hook about sunrise");
  await expect(lyric).toHaveValue(/sunrise/);

  // duration slider
  const duration = page.locator('input[name="duration"][type="range"]').first();
  await expect(duration).toBeVisible();
  await duration.evaluate((el: HTMLInputElement, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, "60");

  // bpm slider
  const bpm = page.locator('input[name="bpm"][type="range"]').first();
  await expect(bpm).toBeVisible();
  await bpm.evaluate((el: HTMLInputElement, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, "120");

  // cfg slider
  const cfg = page.locator('input[name="cfg_scale"][type="range"]').first();
  await expect(cfg).toBeVisible();
  await cfg.evaluate((el: HTMLInputElement, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, "7");

  // temperature and top_p
  const temp = page.locator('input[name="temperature"][type="range"]').first();
  if ((await temp.count()) > 0) {
    await temp.evaluate((el: HTMLInputElement, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, "1.2");
  }
  const topP = page.locator('input[name="top_p"][type="range"]').first();
  if ((await topP.count()) > 0) {
    await topP.evaluate((el: HTMLInputElement, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, "0.9");
  }

  // keyscale select
  const keyscale = page.locator('select[name="keyscale"]').first();
  await expect(keyscale).toBeVisible();
  await keyscale.selectOption("C major");

  // time signature radios - click 3/4
  const ts34 = page.locator('input[name="timesignature"][value="3"]').first();
  await expect(ts34).toBeVisible();
  await ts34.click();
  await expect(ts34).toBeChecked();
  // back to 4/4
  const ts44 = page.locator('input[name="timesignature"][value="4"]').first();
  await ts44.click();
  await expect(ts44).toBeChecked();

  // Reset button (not Generate)
  const resetBtn = page.getByRole("button", { name: "Reset" }).first();
  await expect(resetBtn).toBeVisible();
  await resetBtn.click();

  const generateBtn = page.getByRole("button", { name: /Generate/i }).first();
  await expect(generateBtn).toBeVisible();
  await expect(page).toHaveURL(/\/create\/audio/);
});
