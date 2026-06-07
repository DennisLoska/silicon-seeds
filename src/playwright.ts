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

const browser = await chromium.launch({ headless: true });

for (const { url, output } of urls) {
  const page = await browser.newPage();
  console.log(`Navigating to ${url} ...`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // Wait for main content to render (ads/trackers may still be loading)
  await new Promise((r) => setTimeout(r, 4_000));

  const screenshotPath = `./screenshots/${output}`;
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved ${screenshotPath}`);

  await page.close();
}

await browser.close();
console.log("Done.");
