import z from "zod/v3";
import { LLM } from "../llm/llm";
import { Playwright } from "../utils/playwright";
import { Logger } from "../logger/logger";

const urls = [
  "https://www.newsweek.com/jordan-peterson-chronic-condition-mikhaila-peterson-2113371",
  "https://www.christianpost.com/news/jordan-peterson-still-very-sick-amid-neurological-battle.html",
  "https://thetyee.ca/News/2025/12/10/Jordan-Peterson-School/",
];

const yt_urls = [
  "https://www.youtube.com/watch?v=1dY2j1fH1Tw", // Jordan Peterson Wife Confirms the Sad Truth He Will Not Return to Public Life
  "https://www.youtube.com/watch?v=0KCU8HKci1Y", // Dinner With Jordan Peterson
  "https://www.youtube.com/watch?v=3VgRb24HqqY", // The BIGGEST LIE About Israel and Palestine Debunked by Benjamin Netanyahu | Jordan Peterson Debates
];

async function urls_to_screenshots(urls: string[]) {
  const res = await LLM.structured(
    `Generate a list of filenames in snake_case for screenshots of the provided urls: ${urls}`,
    z.array(z.string()).min(urls.length),
  );

  if (!res) return;
  const names = res.parsed;

  await Playwright.takeScreenshots({
    urls: urls.map((url, i) => ({ url, output: names[i] })),
    outDir: "/tmp",
  });

  process.exit(0);
}

async function urls_to_video_clisp(urls: string[]) {}

await Logger.init();
urls_to_screenshots(urls);
