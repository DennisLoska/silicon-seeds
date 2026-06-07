import { chromium } from "playwright";

const urls = [
  {
    url: "https://www.newsweek.com/jordan-peterson-chronic-condition-mikhaila-peterson-2113371",
    output: "newsweek-jordan-peterson-cirs-diagnosis.png",
  },
  {
    url: "https://www.christianpost.com/news/jordan-peterson-still-very-sick-amid-neurological-battle.html",
    output: "christianpost-jordan-peterson-neurological-battle.png",
  },
  {
    url: "https://thetyee.ca/News/2025/12/10/Jordan-Peterson-School/",
    output: "tyee-jordan-peterson-school-accreditation.png",
  },
];

// Common cookie/consent banner selectors to try (ordered by specificity)
const cookieSelectors = [
  // OneTrust specific
  "#onetrust-accept-btn-handler",
  "#onetrust-reject-all-btn-handler",
  ".ot-pc-footer button",

  // Generic accept / reject / consent
  'button[aria-label*="accept"]',
  'button[aria-label*="Accept"]',
  'button[data-testid*="accept"]',
  'button[class*="accept"]',
  'button[class*="reject"]',
  'button[class*="decline"]',
  'button[aria-label*="consent"]',
  'button[aria-label*="Consent"]',
  'button[data-testid*="consent"]',
  'button[class*="consent"]',

  // Generic cookie banner containers
  "#CybotCookiebotDialogBodyLevelButtonAccept",
  ".cc-accept-all",
];

async function dismissCookies(page: Awaited<ReturnType<typeof browser.newPage>>) {
  await new Promise((r) => setTimeout(r, 2_000));

  // First pass: try known selectors (only click if button is in viewport)
  for (const sel of cookieSelectors) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      const box = await btn.boundingBox().catch(() => null);
      if (box && box.y >= 0 && box.y < page.viewportSize()?.height!) {
        await btn.click();
        console.log(`  Dismissed via selector: ${sel}`);
        return true;
      }
    }
  }

  // Second pass: look for fixed-position overlays at the bottom of viewport (typical cookie banner placement)
  const banners = page.locator(
    "div[class*='cookie'], div[id*='cookie'], div[class*='consent'], div[class*='privacy']"
  );
  const count = await banners.count();
  for (let i = 0; i < count; i++) {
    const banner = banners.nth(i);
    if (!await banner.isVisible().catch(() => false)) continue;

    const box = await banner.boundingBox().catch(() => null);
    if (!box) continue;

    // Cookie banners are typically at the bottom of the viewport (y > 60% down)
    const vpHeight = page.viewportSize()?.height ?? 1080;
    if (box.y < vpHeight * 0.5) continue;

    // Find buttons inside this banner
    const btns = banner.locator("button, a[href], [role='button']");
    const btnCount = await btns.count();
    for (let j = 0; j < Math.min(btnCount, 5); j++) {
      const b = btns.nth(j);
      if (await b.isVisible().catch(() => false)) {
        try {
          await b.click({ timeout: 3000 });
          console.log(`  Dismissed cookie banner button inside container`);
          return true;
        } catch {
          // Click failed, try next button
        }
      }
    }
  }

  // Third pass: press Escape (many banners dismiss with ESC)
  await page.keyboard.press("Escape");
  console.log(`  Dismissed via Escape key`);
  return false;
}

const browser = await chromium.launch({ headless: true });

for (const { url, output } of urls) {
  const page = await browser.newPage();
  console.log(`Navigating to ${url} ...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // Try dismissing cookies up to 3 times (some sites show multiple banners)
  for (let attempt = 0; attempt < 3; attempt++) {
    const dismissed = await dismissCookies(page);
    if (!dismissed) break;
    await new Promise((r) => setTimeout(r, 1_500));
  }

  // Final wait for content to settle
  await new Promise((r) => setTimeout(r, 2_000));

  const screenshotPath = `./screenshots/${output}`;
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved ${screenshotPath}`);

  await page.close();
}

await browser.close();
console.log("Done.");
