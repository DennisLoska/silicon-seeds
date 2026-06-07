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

const OUTPUT_DIR = "/tmp/wip";
const MAX_CLIPS_PER_VIDEO = 3; // max semantic clips extracted per source video
const MAX_CLIP_SECONDS = 10;
const CLIP_END_BUFFER_MS = 0.1; // seconds of buffer at end to avoid cutting words harshly
const SCORE_THRESHOLD = 0.2; // minimum relevance score to consider a clip valid

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

interface VideoInfo {
  url: string;
  mp4Path: string;
  safeName: string;
}

/** Download each YouTube video as MP4, skipping if one already exists. */
async function downloadVideos(videoUrls: string[]): Promise<VideoInfo[]> {
  const videoPaths: VideoInfo[] = [];

  for (const url of videoUrls) {
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

  return videoPaths;
}

// ── Step 2: Transcribe videos ────────────────────────────────────────────────

interface Transcript {
  mp4Path: string;
  safeName: string;
  segments: Array<{ text: string; start: number; end: number }>;
}

/** Transcribe each video with WhisperX and return timestamped segments. */
async function transcribeVideos(videos: VideoInfo[]): Promise<Transcript[]> {
  const transcripts: Transcript[] = [];

  for (const { mp4Path, safeName } of videos) {
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

  return transcripts;
}

/** Construct the LLM prompt for scoring transcript segments against the baseline. */
function buildScoringPrompt(segments: Transcript["segments"]): string {
  const segmentList = segments
    .map(
      (s, i) =>
        `  [${i}] t=${s.start.toFixed(1)}-${s.end.toFixed(1)}s | ${s.text}`,
    )
    .join("\n");

  return `You are a video clip curator. Your job is to group adjacent transcript segments into coherent, self-contained clips that align with a specific topic (the "baseline").

The baseline topic is:
${SCRIPT_BASELINE}

Here are all transcript segments from the video, each with its index, time range, and text:

${segmentList}

Return ONLY a JSON array of clip objects matching this schema (no extra keys, no markdown):
[
  {
    "clip_index": <integer starting at 1>,
    "segment_indices": [<array of adjacent segment indices that form this clip>],
    "start": <number — the start time of the first segment in the group>,
    "end": <number — the end time of the last segment in the group>,
    "combined_text": "<all segment texts joined together>",
    "relevance_score": <float 0-1>
  }
]

Rules:
- Segment indices in each group MUST be adjacent (no gaps)
- Include as many clips as you can find that are relevant — these are suggestions/best guesses
- relevance_score: 0.0 = completely unrelated, 1.0 = directly on-topic
- Be generous — even loosely relevant segments should score above 0.3
- If a single segment is already coherent and relevant, it can be its own clip (just one index in the array)
`;
}

interface LLMClip {
  clip_index: number;
  segment_indices: number[];
  start: number;
  end: number;
  combined_text: string;
  relevance_score: number;
}

/** Call the LLM to score segments, then filter by threshold and pick top-N. */
async function scoreAndSelectClips(
  safeName: string,
  segments: Transcript["segments"],
): Promise<LLMClip[]> {
  Logger.info(`[3/5] Evaluating ${safeName} (${segments.length} segments)`);

  const prompt = buildScoringPrompt(segments);

  const res = await LLM.structured(
    prompt,
    z
      .array(
        z.object({
          clip_index: z.number(),
          segment_indices: z.array(z.number()),
          start: z.number(),
          end: z.number(),
          combined_text: z.string(),
          relevance_score: z.number().min(0).max(1),
        }),
      )
      .min(1)
      .max(MAX_CLIPS_PER_VIDEO),
  );

  if (!res) {
    Logger.error(`  LLM failed to score segments for ${safeName}`);
    return [];
  }

  const clips = res.parsed;

  Logger.info(`  LLM returned ${clips.length} clip proposals`);

  // Log all scores for debugging
  if (clips.length === 0) {
    Logger.warn(`  No clips proposed — check the prompt/LLM response`);
  } else {
    for (const c of clips) {
      Logger.info(
        `    clip ${c.clip_index}: segments=[${c.segment_indices.join(",")}], relevance=${c.relevance_score.toFixed(2)}, duration=${(c.end - c.start).toFixed(1)}s`,
      );
    }
  }

  const validClips = clips.filter(
    (c) => c.relevance_score >= SCORE_THRESHOLD && c.end - c.start > 0,
  );

  // Sort by relevance descending, pick top-N
  const selected = validClips.sort(
    (a, b) => b.relevance_score - a.relevance_score,
  );

  Logger.info(`  Selected ${selected.length} clips for ${safeName}`);

  return selected;
}

interface FinalClip {
  sourceSafeName: string;
  clipIndex: number;
  start: number;
  end: number;
  text: string;
  outputPath: string;
}

/** Trim selected clips with ffmpeg and return metadata for each. */
async function trimSelectedClips(
  mp4Path: string,
  safeName: string,
  selected: LLMClip[],
): Promise<FinalClip[]> {
  const clipDir = join(OUTPUT_DIR, safeName);
  await mkdir(clipDir, { recursive: true });

  const createdClips: FinalClip[] = [];

  for (let i = 0; i < selected.length; i++) {
    const c = selected[i];

    // Add buffer at end so we don't cut the last word harshly
    const clipEnd = Math.min(
      c.end + CLIP_END_BUFFER_MS,
      c.start + MAX_CLIP_SECONDS,
    );

    const outputPath = join(
      clipDir,
      `clip_${String(i + 1).padStart(2, "0")}.mp4`,
    );

    Logger.info(
      `[5/5] Trimming clip ${i + 1}/${selected.length}: segments=[${c.segment_indices.join(",")}], t=${c.start.toFixed(1)}-${clipEnd.toFixed(1)}s (${(clipEnd - c.start).toFixed(1)}s)`,
    );

    await trimSegment(mp4Path, outputPath, c.start, clipEnd);
    const stat = await Bun.file(outputPath).stat();
    Logger.info(
      `    → ${outputPath} (${(stat.size / 1_000_000).toFixed(2)} MB)`,
    );

    createdClips.push({
      sourceSafeName: safeName,
      clipIndex: i + 1,
      start: c.start,
      end: clipEnd,
      text: c.combined_text,
      outputPath,
    });
  }

  return createdClips;
}

/** Print the final summary of all generated clips. */
function printSummary(clips: FinalClip[]) {
  Logger.info(`\nDone! Generated ${clips.length} clips total.`);
  for (const clip of clips) {
    Logger.info(
      `  [${clip.sourceSafeName}] clip_${String(clip.clipIndex).padStart(2, "0")}.mp4 (${clip.start.toFixed(1)}-${clip.end.toFixed(1)}s)`,
    );
  }
}

/**
 * urls_to_video_clips — full pipeline:
 *   1. Download each YouTube video as MP4
 *   2. Transcribe with WhisperX → get timestamped segments
 *   3. Ask LLM to score every segment against the SCRIPT_BASELINE
 *   4. Pick top-N clips per video (max MAX_CLIPS_PER_VIDEO), ensuring each is
 *      between MIN_CLIP_SECONDS and MAX_CLIP_SECONDS long
 *   5. Trim those segments with ffmpeg into /tmp/wip/<video>/clip_*.mp4
 */
async function urls_to_video_clips(videoUrls: string[]) {
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Step 1: Download videos
  const videos = await downloadVideos(videoUrls);

  // Step 2: Transcribe all videos
  const transcripts = await transcribeVideos(videos);

  // Steps 3-5: Score, select, and trim clips for each video
  const allClips: FinalClip[] = [];

  for (const { mp4Path, safeName, segments } of transcripts) {
    const selected = await scoreAndSelectClips(safeName, segments);
    const created = await trimSelectedClips(mp4Path, safeName, selected);
    allClips.push(...created);
  }

  // Summary
  printSummary(allClips);

  process.exit(0);
}

// ── Entry point ──────────────────────────────────────────────────────────────

await Logger.init();
urls_to_video_clips(yt_urls);
// urls_to_screenshots(urls);
