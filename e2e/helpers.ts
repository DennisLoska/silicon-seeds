import { expect, type Page } from "@playwright/test";

export async function gotoAndExpectHeading(
  page: Page,
  path: string,
  headingRegex: RegExp,
) {
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: headingRegex }).first(),
  ).toBeVisible({ timeout: 10000 });
}
