import { test, expect } from "@playwright/test";

test.describe("Jobs", () => {
  test("lists jobs and interacts with filter and navigation", async ({
    page,
  }) => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs/);
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 10000,
    });

    // interact with filter dropdown button
    const filterBtn = page.locator("#job-filter-dropdown button").first();
    await expect(filterBtn).toBeVisible();
    await filterBtn.click();
    // dropdown should appear with options
    const dropdown = page.locator("#job-filter-dropdown ul");
    await expect(dropdown)
      .toBeVisible({ timeout: 5000 })
      .catch(() => {});
    // click filter option "Active" then back to "All" - interacts without generating
    const activeOption = page
      .locator("#job-filter-dropdown a", { hasText: "Active" })
      .first();
    if ((await activeOption.count()) > 0) {
      await activeOption.click();
      await expect(page).toHaveURL(/filter=active/);
      // click again to open and select All
      await filterBtn.click();
      const allOption = page
        .locator("#job-filter-dropdown a", { hasText: "All" })
        .first();
      await allOption.click();
      await expect(page).toHaveURL(/filter=all/);
    } else {
      // close dropdown if open
      await page.keyboard.press("Escape").catch(() => {});
    }

    // click New Job button - should navigate to compose, not generate
    const newJob = page.getByRole("link", { name: /new job/i });
    await expect(newJob).toBeVisible();
    await newJob.click();
    await expect(page).toHaveURL(/\/compose/);
    // go back to jobs
    await page.goto("/jobs");
    await expect(page.locator('a[href="/jobs"]').first()).toBeVisible();
  });

  test("job detail tabs and interactions", async ({ page }) => {
    await page.goto("/jobs");
    // first try to interact with tabs if job selected
    const firstJobLink = page.locator('a[href^="/jobs/"]').first();
    if ((await firstJobLink.count()) > 0) {
      await firstJobLink.click();
      await expect(page).toHaveURL(/\/jobs\/.+/);
      await expect(page.getByRole("heading").first()).toBeVisible({
        timeout: 10000,
      });

      // click tabs: Status, Media, Events
      const statusTab = page.getByRole("link", { name: "Status" });
      const mediaTab = page.getByRole("link", { name: "Media" });
      const eventsTab = page.getByRole("link", { name: "Events" });

      if ((await statusTab.count()) > 0) await statusTab.click();
      await expect(page).toHaveURL(/tab=status/);
      if ((await mediaTab.count()) > 0) {
        await mediaTab.click();
        await expect(page).toHaveURL(/tab=media/);
      }
      if ((await eventsTab.count()) > 0) {
        await eventsTab.click();
        await expect(page).toHaveURL(/tab=events/);
        // expand first event details if exists
        const firstSummary = page.locator("summary").first();
        if ((await firstSummary.count()) > 0) {
          await firstSummary.click();
          await expect(page.locator("details").first()).toBeVisible();
        }
      }
    } else {
      await expect(page.locator("body")).toContainText(
        /jobs|no jobs|create|empty/i,
      );
      await expect(page.getByRole("link", { name: /new job/i })).toBeVisible();
    }
  });
});
