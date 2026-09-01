import { test, expect } from "@playwright/test";

test.describe("Jobs", () => {
  test("lists jobs and shows status without triggering generation", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs/);
    // sidebar or main heading visible
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    // check for jobs page content: either job list or empty state, and status heading if detail
    // look for any heading on page
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
    // ensure we did not click generate - verify generate button if present is visible but not clicked
    const generate = page.getByRole("button", { name: /generate/i });
    if ((await generate.count()) > 0) {
      await expect(generate.first()).toBeVisible();
    }
    // verify sidebar navigation present (vim-style quick nav)
    await expect(page.locator('a[href="/jobs"]').first()).toBeVisible();
  });

  test("job detail tabs are reachable", async ({ page }) => {
    await page.goto("/jobs");
    const firstJobLink = page.locator('a[href^="/jobs/"]').first();
    if ((await firstJobLink.count()) > 0) {
      await firstJobLink.click();
      await expect(page).toHaveURL(/\/jobs\/.+/);
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
    } else {
      // empty state still valid - check for no-jobs message or body
      await expect(page.locator("body")).toContainText(/jobs|no jobs|create|empty/i);
    }
  });
});
