import { chromium } from "playwright";
import { Logger } from "../logger/logger";

export interface ScreenshotOptions {
  /** URLs to screenshot. If `output` is omitted, a filename is derived from the URL hostname + slug. */
  urls: Array<{ url: string; output?: string }>;
  /** Directory to write screenshots into (default: "/tmp"). */
  outDir?: string;
}

export interface ScreenshotResult {
  filepath: string;
  url: string;
}

// Common cookie/consent banner selectors to try (ordered by specificity)
const cookieSelectors = [
  // OneTrust specific
  "#onetrust-accept-btn-handler",
  "#onetrust-reject-all-btn-handler",
  ".ot-pc-footer button",

  // Generic accept / reject / consent
  'button[aria-label*="accept"]',
  'button[data-testid*="accept"]',
  'button[class*="accept"]',
  'button[class*="reject"]',
  'button[class*="decline"]',
  'button[aria-label*="consent"]',
  'button[data-testid*="consent"]',
  'button[class*="consent"]',

  // Generic cookie banner containers
  "#CybotCookiebotDialogBodyLevelButtonAccept",
  ".cc-accept-all",
];

function generateOutputName(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/\./g, "-");
    // Extract a slug from the pathname (last segment)
    const segments = parsed.pathname.split("/").filter(Boolean);
    const slug = segments.length > 0 ? segments[segments.length - 1] : "page";
    return `${hostname}-${slug}.png`;
  } catch {
    return `screenshot-${crypto.randomUUID()}.png`;
  }
}

async function dismissCookies(page: import("playwright").Page) {
  await new Promise((r) => setTimeout(r, 3_000));

  const vpHeight = page.viewportSize()?.height ?? 1080;

  // First pass: try known selectors (only click if button is in viewport)
  for (const sel of cookieSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const box = await btn.boundingBox().catch(() => null);
      if (box && box.y >= 0 && box.y < vpHeight) {
        await btn.click();
        return true;
      }
    }
  }

  // First pass b: text-based matching for "Accept All" / "Reject All" buttons
  const acceptTexts = [
    "accept all",
    "accept all cookies",
    "i agree",
    "consent to all",
  ];
  const rejectTexts = ["reject all", "necessary only", "do not sell"];
  for (let retry = 0; retry < 3; retry++) {
    if (retry > 0) await new Promise((r) => setTimeout(r, 1_000));
    for (const text of [...acceptTexts, ...rejectTexts]) {
      const btn = page
        .getByRole("button", { name: new RegExp(text, "i") })
        .first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        const box = await btn.boundingBox().catch(() => null);
        if (box && box.y >= 0 && box.y < vpHeight) {
          await btn.click();
          return true;
        }
      }
    }
  }

  // Second pass: look for cookie/consent containers at the bottom of viewport
  const banners = page.locator(
    "div[class*='cookie'], div[id*='cookie'], div[class*='consent'], div[class*='privacy']",
  );
  const count = await banners.count();
  for (let i = 0; i < count; i++) {
    const banner = banners.nth(i);
    if (!(await banner.isVisible().catch(() => false))) continue;

    const box = await banner.boundingBox().catch(() => null);
    if (!box) continue;

    const vpHeight2 = page.viewportSize()?.height ?? 1080;
    if (box.y < vpHeight2 * 0.5) continue;

    const btns = banner.locator("button, a[href], [role='button']");
    const btnCount = await btns.count();
    for (let j = 0; j < Math.min(btnCount, 5); j++) {
      const b = btns.nth(j);
      if (await b.isVisible().catch(() => false)) {
        try {
          await b.click({ timeout: 3000 });
          return true;
        } catch {
          // try next button
        }
      }
    }
  }

  // Third pass: press Escape (many banners dismiss with ESC)
  await page.keyboard.press("Escape");
  return false;
}

export namespace Playwright {
  /**
   * Take screenshots of a list of URLs, dismissing cookie/consent banners automatically.
   * Returns an array of result objects with `filepath` and `url`.
   */
  export async function takeScreenshots(
    options: ScreenshotOptions,
  ): Promise<ScreenshotResult[]> {
    const outDir = options.outDir ?? "/tmp";

    // Ensure output directory exists
    await Bun.write(outDir + "/.keep", "");

    const browser = await chromium.launch({ headless: true });
    const results: ScreenshotResult[] = [];

    for (const item of options.urls) {
      const page = await browser.newPage();
      const outputName = item.output ?? generateOutputName(item.url);
      const screenshotPath = `${outDir}/${outputName}`;

      Logger.info(`Navigating to ${item.url} ...`);

      await page.goto(item.url, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      // Try dismissing cookies up to 3 times (some sites show multiple banners)
      for (let attempt = 0; attempt < 3; attempt++) {
        const dismissed = await dismissCookies(page);
        if (!dismissed) break;
        await new Promise((r) => setTimeout(r, 1_500));
      }

      // Final wait for content to settle
      await new Promise((r) => setTimeout(r, 2_000));

      await page.screenshot({ path: screenshotPath });
      Logger.info(`Saved ${screenshotPath}`);

      results.push({ filepath: screenshotPath, url: item.url });
      await page.close();
    }

    await browser.close();
    return results;
  }
}
