import z from "zod/v3";
import { spawn } from "bun";
import { join } from "node:path";
import { mkdir, readdir } from "node:fs/promises";

import { LLM } from "../llm/llm";
import { Playwright } from "../utils/playwright";
import { Logger } from "../logger/logger";
import { Utils } from "../utils/utils";
import { WhisperX } from "../whisperx/whisperx";
import { YtDlp } from "../yt/yt";

// ── Configuration ────────────────────────────────────────────────────────────

const OUTPUT_DIR = "/tmp/wip";
const MAX_CLIPS_PER_VIDEO = 3; // max semantic clips extracted per source video
const MIN_CLIP_SECONDS = 1;
const MAX_CLIP_SECONDS = 10;

// The "similarity baseline" — a script idea against which transcript segments
// are evaluated for relevance. Only segments whose content semantically aligns
// with this baseline will be considered as clip candidates.
const SCRIPT_BASELINE = `
Topic: How to properly sacrifice to God as a Christian

Key themes to look for in the video content:
- The concept of spiritual sacrifice in Christianity (offering oneself, time, resources)
- Biblical precedents for sacrifice (Old Testament animal sacrifices, New Testament living sacrifice Romans 12:1)
- Modern practical applications: tithing, fasting, prayer, self-denial, serving others
- The difference between ritual sacrifice and everyday spiritual discipline
- Jesus Christ as the ultimate sacrifice and how that transforms the concept of sacrifice for believers
- What God truly desires from a sacrificial heart versus empty religious performance
`;

// YouTube URLs to process
const yt_urls = [
  "https://www.youtube.com/watch?v=4zG583WPNWQ", // You Have to Sacrifice… - Jordan Peterson (14s)
  "https://www.youtube.com/watch?v=0KCU8HKci1Y", // Dinner With Jordan Peterson (28s)
  "https://www.youtube.com/watch?v=3VgRb24HqqY", // The BIGGEST LIE About Israel and Palestine Debunked by Benjamin Netanyahu | Jordan Peterson Debates (59s)
];

// Legacy: news article URLs for screenshot workflow
const urls = [
  "https://www.newsweek.com/jordan-peterson-chronic-condition-mikhaila-peterson-2113371",
  "https://www.christianpost.com/news/jordan-peterson-still-very-sick-amid-neurological-battle.html",
  "https://thetyee.ca/News/2025/12/10/Jordan-Peterson-School/",
];

// ── Screenshot workflow (separate feature) ───────────────────────────────────

async function urls_to_screenshots(urls: string[]) {
  const res = await LLM.structured(
    `Generate a list of filenames in snake_case for screenshots of the provided urls: ${urls}`,
    z.array(z.string()).min(urls.length),
  );

  if (!res) return;
  const names = res.parsed;

  await Playwright.takeScreenshots({
    urls: urls.map((url, i) => ({ url, output: names[i] })),
    outDir: OUTPUT_DIR,
  });

  process.exit(0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Trim a video to [start, end) seconds using ffmpeg. */
async function trimSegment(
  inputPath: string,
  outputPath: string,
  start: number,
  end: number,
) {
  const process = spawn({
    cmd: [
      "ffmpeg",
      "-y",
      "-ss",
      String(start),
      "-to",
      String(end),
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    stdio: ["ignore", "pipe", "pipe"],
  });

  const { stderr, exitCode } = await Utils.collectProcessOutput(process);
  if (exitCode !== 0) {
    throw new Error(`ffmpeg segment trim failed: ${stderr.trim()}`);
  }
}

// ── Core pipeline ────────────────────────────────────────────────────────────

/**
 * urls_to_video_clips — full pipeline:
 *   1. Download each YouTube video as MP4
 *   2. Transcribe with WhisperX → get timestamped segments
 *   3. Ask LLM to score every segment against the SCRIPT_BASELINE
 *   4. Pick top-N clips per video (max MAX_CLIPS_PER_VIDEO), ensuring each is
 *      between MIN_CLIP_SECONDS and MAX_CLIP_SECONDS long
 *   5. Trim those segments with ffmpeg into /tmp/wip/<video>/clip_*.mp4
 */
async function urls_to_video_clips(urls: string[]) {
  await mkdir(OUTPUT_DIR, { recursive: true });

  // ── Step 1: Download videos ───────────────────────────────────────────────
  const videoPaths: Array<{ url: string; mp4Path: string; safeName: string }> =
    [];

  for (const url of urls) {
    Logger.info(`[1/5] Downloading ${url}`);

    // Get metadata first to know the title
    let title = "video";
    try {
      const infoList = await YtDlp.list(url);
      if (infoList.length > 0) {
        title = infoList[0].title ?? "video";
      }
    } catch {
      // fallback: extract video ID from URL
      const match = url.match(/v=([^&]+)/);
      if (match) title = `video_${match[1]}`;
    }

    const safeName = YtDlp.sanitizeTitle(title);
    const videoDir = join(OUTPUT_DIR, safeName);
    await mkdir(videoDir, { recursive: true });

    // Check for existing MP4 to avoid re-downloading
    const entries = await readdir(videoDir);
    const existingMp4 = entries.find(
      (e) => e.startsWith(safeName) && e.endsWith(".mp4"),
    );

    let mp4Path: string;
    if (existingMp4) {
      Logger.info(`  Already exists: ${existingMp4}, skipping download`);
      mp4Path = join(videoDir, existingMp4);
    } else {
      mp4Path = await YtDlp.downloadVideo(url, videoDir, safeName);
    }

    videoPaths.push({ url, mp4Path, safeName });
  }

  // ── Step 2: Transcribe with WhisperX ──────────────────────────────────────
  const transcripts: Array<{
    mp4Path: string;
    safeName: string;
    segments: Array<{ text: string; start: number; end: number }>;
  }> = [];

  for (const { mp4Path, safeName } of videoPaths) {
    Logger.info(`[2/5] Transcribing ${safeName}`);

    const jsonPath = await WhisperX.run(mp4Path, OUTPUT_DIR);
    const data = JSON.parse(await Bun.file(jsonPath).text());
    const segments = (data.segments ?? []).map((s: any) => ({
      text: s.text?.trim() ?? "",
      start: Number(s.start) ?? 0,
      end: Number(s.end) ?? 0,
    }));

    transcripts.push({ mp4Path, safeName, segments });
  }

  // ── Step 3 & 4: LLM scoring + clip selection ──────────────────────────────
  const allClips: Array<{
    sourceSafeName: string;
    clipIndex: number;
    start: number;
    end: number;
    text: string;
    outputPath: string;
  }> = [];

  for (const { mp4Path, safeName, segments } of transcripts) {
    Logger.info(`[3/5] Evaluating ${safeName} (${segments.length} segments)`);

    // Build segment list for LLM prompt
    const segmentList = segments
      .map(
        (s, i) =>
          `  [${i}] t=${s.start.toFixed(1)}-${s.end.toFixed(1)}s | ${s.text}`,
      )
      .join("\n");

    const prompt = `You are a video clip curator. Your job is to find the most relevant segments from a video transcript that align with a specific topic (the "baseline").

The baseline topic is:
${SCRIPT_BASELINE}

Here are all transcript segments from the video, each with its index, time range, and text:

${segmentList}

For EACH segment, evaluate how well it relates to the baseline topic. Return ONLY a JSON array of objects matching this schema (no extra keys, no markdown):
[
  {
    "segment_index": <integer>,
    "start": <number>,
    "end": <number>,
    "text": "<the segment text>",
    "relevance_score": <float 0-1>
  }
]

Rules:
- relevance_score: 0.0 = completely unrelated, 1.0 = directly on-topic
- Include ALL segments in the output (do not skip any)
- Be strict — only high-quality relevant segments should score above 0.5
`;

    const res = await LLM.structured(
      prompt,
      z.array(
        z.object({
          segment_index: z.number(),
          start: z.number(),
          end: z.number(),
          text: z.string(),
          relevance_score: z.number().min(0).max(1),
        }),
      ),
    );

    if (!res) {
      Logger.error(`  LLM failed to score segments for ${safeName}`);
      continue;
    }

    const scored = res.parsed;

    // Filter: relevance >= 0.5, duration within bounds
    const candidates = scored.filter(
      (s) =>
        s.relevance_score >= 0.5 &&
        s.end - s.start >= MIN_CLIP_SECONDS &&
        s.end - s.start <= MAX_CLIP_SECONDS,
    );

    // Sort by relevance descending, pick top-N
    candidates.sort((a, b) => b.relevance_score - a.relevance_score);
    const selected = candidates.slice(0, MAX_CLIPS_PER_VIDEO);

    Logger.info(`  Selected ${selected.length} clips for ${safeName}`);

    // ── Step 5: Trim with ffmpeg ────────────────────────────────────────────
    const clipDir = join(OUTPUT_DIR, safeName);
    await mkdir(clipDir, { recursive: true });

    for (let i = 0; i < selected.length; i++) {
      const c = selected[i];
      const outputPath = join(
        clipDir,
        `clip_${String(i + 1).padStart(2, "0")}.mp4`,
      );

      Logger.info(
        `[5/5] Trimming clip ${i + 1}/${selected.length}: t=${c.start.toFixed(1)}-${c.end.toFixed(1)}s`,
      );

      await trimSegment(mp4Path, outputPath, c.start, c.end);
      const stat = await Bun.file(outputPath).stat();
      Logger.info(
        `    → ${outputPath} (${(stat.size / 1_000_000).toFixed(2)} MB)`,
      );

      allClips.push({
        sourceSafeName: safeName,
        clipIndex: i + 1,
        start: c.start,
        end: c.end,
        text: c.text,
        outputPath,
      });
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  Logger.info(`\nDone! Generated ${allClips.length} clips total.`);
  for (const clip of allClips) {
    Logger.info(
      `  [${clip.sourceSafeName}] clip_${String(clip.clipIndex).padStart(2, "0")}.mp4 (${clip.start.toFixed(1)}-${clip.end.toFixed(1)}s)`,
    );
  }

  process.exit(0);
}

// ── Entry point ──────────────────────────────────────────────────────────────

await Logger.init();
urls_to_video_clips(yt_urls);
// urls_to_screenshots(urls);
