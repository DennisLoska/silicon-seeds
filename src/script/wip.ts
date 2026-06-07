import z from "zod/v3";
import { LLM } from "../llm/llm";
import { Playwright } from "../utils/playwright";
import { Logger } from "../logger/logger";

const urls = [
  "https://www.newsweek.com/jordan-peterson-chronic-condition-mikhaila-peterson-2113371",
  "https://www.christianpost.com/news/jordan-peterson-still-very-sick-amid-neurological-battle.html",
  "https://thetyee.ca/News/2025/12/10/Jordan-Peterson-School/",
];

async function main() {
  await Logger.init();
  const res = await LLM.structured(
    `Generate a list of filenames in snake_case for screenshots of the provided urls: ${urls}`,
    z.array(z.string()).min(urls.length),
  );

  if (!res) return;
  const names = res.parsed;

  Playwright.takeScreenshots({
    urls: urls.map((url, i) => ({ url, output: names[i] })),
    outDir: "./screenshots",
  });
}

main();
