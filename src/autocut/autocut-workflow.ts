import { mkdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { spawn } from "bun";
import { Logger } from "../logger/logger";
import { Metadata } from "../meta/meta";
import {
  PromptGenerator,
  type AutoCutRemovalSpan,
} from "../prompts/prompt-generator";
import { JobOrchestrator } from "../jobs/jobs";
import { TextGenerator } from "../text/text-generator";
import { ImageGenerator } from "../image/image-generator";
import { VideoGenerator } from "../video/video-generator";
import { DB } from "../db/db";
import {
  Event,
  JobMode,
  JobStatus,
  type ImagePromptEvent,
  type JobEvent,
  type TransitionPromptEvent,
  type VideoPromptEvent,
} from "../events/events";
import { Presets } from "../styles/presets";
import { QueueManager } from "../queue/queue-manager";
import { Utils } from "../utils/utils";

const TMP_ROOT = "/tmp/silicon-seeds-autocut";
const OUTPUT_SUBDIR = "autocut";
const CUT_CLIP_SUBDIR = `${OUTPUT_SUBDIR}/cut-clips`;
const MIN_KEEP_SPAN_SECONDS = 0.08;
const SILENCE_GAP_SECONDS = 0.8;
const SILENCE_EDGE_PADDING_SECONDS = 0.04;

export type AutoCutStage =
  | "queued"
  | "transcribing"
  | "analyzing"
  | "rendering"
  | "complete"
  | "failed";

export interface AutoCutState {
  jobId: string;
  stage: AutoCutStage;
  createdAt: string;
  updatedAt: string;
  inputFilename: string;
  message: string;
  transcriptLanguage?: string;
  transcriptWordCount?: number;
  videoDurationSeconds?: number;
  removedDurationSeconds?: number;
  removalCount?: number;
  insertionsCount?: number;
  warnings?: string[];
  outputVideoPath?: string;
  outputVideoAssetPath?: string;
  error?: string;
  removals?: AutoCutRemovalSpan[];
  cutClips?: AutoCutCutClip[];
}

export interface AutoCutCutClip {
  index: number;
  start: number;
  end: number;
  durationSeconds: number;
  removals: AutoCutRemovalSpan[];
  filename?: string;
  subfolder?: string;
  outputPath?: string;
  outputAssetPath?: string;
}

export interface AutoCutGenerationSettings {
  fps: number;
  resolution: string;
  clip_duration: number;
  transition_duration: number;
  image_model: string;
  video_model: string;
  style_preset: Presets;
}

interface WhisperXWord {
  word?: string;
  start?: number;
  end?: number;
  score?: number;
}

interface WhisperXSegment {
  start?: number;
  end?: number;
  text?: string;
  words?: WhisperXWord[];
}

interface WhisperXTranscript {
  language?: string;
  segments?: WhisperXSegment[];
}

interface TimeSpan {
  start: number;
  end: number;
}

interface AutoCutInsertionPlan {
  insertionId: string;
  timestamp: number;
  prompt: string;
  transcriptContext: string;
  imageEventId?: string;
  videoEventId?: string;
}

interface AutoCutManifest {
  inputPath: string;
  whisperJsonPath?: string;
  durationSeconds?: number;
  transcriptLanguage?: string;
  removalSpans?: AutoCutRemovalSpan[];
  cutClips?: AutoCutCutClip[];
  keepSpans?: TimeSpan[];
  insertionPlans?: AutoCutInsertionPlan[];
  outputVideoPath?: string;
  generateInsertClips?: boolean;
}

interface SourceTimelineItem {
  kind: "source";
  start: number;
  end: number;
}

interface InsertionTimelineItem {
  kind: "insertion";
  insertion: AutoCutInsertionPlan;
  start: number;
  end: number;
}

type TimelineItem = SourceTimelineItem | InsertionTimelineItem;

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function slugifyFilename(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "upload"
  );
}

function workspaceDir(jobId: string) {
  return join(TMP_ROOT, jobId);
}

function statusFile(jobId: string) {
  return join(workspaceDir(jobId), "status.json");
}

function manifestFile(jobId: string) {
  return join(workspaceDir(jobId), "manifest.json");
}

function tmpVideoPath(jobId: string, eventId: string) {
  return `/tmp/${jobId}_${eventId}.mp4`;
}

async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

async function readManifest(jobId: string) {
  const file = Bun.file(manifestFile(jobId));
  if (!(await file.exists())) {
    return null;
  }

  return (await file.json()) as AutoCutManifest;
}

async function writeManifest(jobId: string, manifest: AutoCutManifest) {
  await ensureDir(workspaceDir(jobId));
  await Bun.write(
    manifestFile(jobId),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

async function updateManifest(jobId: string, patch: Partial<AutoCutManifest>) {
  const current = await readManifest(jobId);
  Utils.assert(current, `Missing autocut manifest for ${jobId}`);
  const next = {
    ...current,
    ...patch,
  } satisfies AutoCutManifest;
  await writeManifest(jobId, next);
  return next;
}

async function collectProcessOutput(process: ReturnType<typeof spawn>) {
  const decoder = new TextDecoder();
  let stdout = "";
  let stderr = "";

  if (process.stdout && typeof process.stdout !== "number") {
    for await (const chunk of process.stdout) {
      stdout += typeof chunk === "string" ? chunk : decoder.decode(chunk);
    }
  }

  if (process.stderr && typeof process.stderr !== "number") {
    for await (const chunk of process.stderr) {
      stderr += typeof chunk === "string" ? chunk : decoder.decode(chunk);
    }
  }

  const exitCode = await process.exited;
  return { stdout, stderr, exitCode };
}

function normalizeSpans(spans: TimeSpan[], duration: number) {
  const filtered = spans
    .map((span) => ({
      start: clampNumber(roundTime(span.start), 0, duration),
      end: clampNumber(roundTime(span.end), 0, duration),
    }))
    .filter((span) => span.end - span.start >= MIN_KEEP_SPAN_SECONDS)
    .sort((a, b) => a.start - b.start);

  const merged: TimeSpan[] = [];
  for (const span of filtered) {
    const last = merged.at(-1);
    if (!last || span.start > last.end) {
      merged.push(span);
      continue;
    }

    last.end = Math.max(last.end, span.end);
  }

  return merged.map((span) => ({
    start: roundTime(span.start),
    end: roundTime(span.end),
  }));
}

function invertSpans(removals: TimeSpan[], duration: number) {
  const keep: TimeSpan[] = [];
  let cursor = 0;

  for (const removal of normalizeSpans(removals, duration)) {
    if (removal.start - cursor >= MIN_KEEP_SPAN_SECONDS) {
      keep.push({ start: roundTime(cursor), end: roundTime(removal.start) });
    }

    cursor = Math.max(cursor, removal.end);
  }

  if (duration - cursor >= MIN_KEEP_SPAN_SECONDS) {
    keep.push({ start: roundTime(cursor), end: roundTime(duration) });
  }

  return keep;
}

function dedupeRemovals(removals: AutoCutRemovalSpan[], duration: number) {
  const keyed = new Map<string, AutoCutRemovalSpan>();

  for (const removal of removals) {
    const paddedStart = clampNumber(removal.start - 0.04, 0, duration);
    const paddedEnd = clampNumber(removal.end + 0.06, 0, duration);
    if (paddedEnd - paddedStart < MIN_KEEP_SPAN_SECONDS) {
      continue;
    }

    const key = `${roundTime(paddedStart)}:${roundTime(paddedEnd)}:${removal.reason}`;
    const previous = keyed.get(key);
    if (!previous || (removal.confidence ?? 0) > (previous.confidence ?? 0)) {
      keyed.set(key, {
        ...removal,
        start: roundTime(paddedStart),
        end: roundTime(paddedEnd),
      });
    }
  }

  return Array.from(keyed.values()).sort((a, b) => a.start - b.start);
}

function spansOverlap(a: TimeSpan, b: TimeSpan) {
  return a.start < b.end && b.start < a.end;
}

function buildCutClips(
  removals: AutoCutRemovalSpan[],
  duration: number,
): AutoCutCutClip[] {
  return normalizeSpans(removals, duration).map((span, index) => ({
    index,
    start: span.start,
    end: span.end,
    durationSeconds: roundTime(span.end - span.start),
    removals: removals.filter((removal) => spansOverlap(span, removal)),
  }));
}

function summarizeClipReasons(clip: AutoCutCutClip) {
  return Array.from(
    new Set(clip.removals.map((removal) => removal.reason)),
  ).join(", ");
}

function summarizeClipTranscript(clip: AutoCutCutClip) {
  return clip.removals
    .map((removal) => removal.text.trim())
    .filter(
      (value, index, values) =>
        value.length > 0 && values.indexOf(value) === index,
    )
    .join(" ");
}

async function materializeCutClips(
  jobId: string,
  inputPath: string,
  cutClips: AutoCutCutClip[],
) {
  const outputDir = Bun.env.OUTPUT_DIR;
  Utils.assert(outputDir, "OUTPUT_DIR environment variable is not configured");
  await ensureDir(join(outputDir, CUT_CLIP_SUBDIR));

  const materializedClips: AutoCutCutClip[] = [];

  for (const clip of cutClips) {
    const filename = `${jobId}-cut-${String(clip.index + 1).padStart(3, "0")}.mp4`;
    const tempPath = join(
      workspaceDir(jobId),
      `cut-clip-${String(clip.index + 1).padStart(3, "0")}.mp4`,
    );
    const outputPath = join(outputDir, CUT_CLIP_SUBDIR, filename);
    await trimMediaSegment(inputPath, tempPath, clip.start, clip.end);
    await Bun.write(outputPath, await Bun.file(tempPath).arrayBuffer());

    materializedClips.push({
      ...clip,
      filename,
      subfolder: CUT_CLIP_SUBDIR,
      outputPath,
      outputAssetPath: `/assets/${CUT_CLIP_SUBDIR}/${filename}`,
    });
  }

  await DB.AutoCutCutClips.replaceForJob(
    jobId,
    materializedClips.map((clip) => ({
      clip_index: clip.index,
      start_seconds: clip.start,
      end_seconds: clip.end,
      duration_seconds: clip.durationSeconds,
      reasons: summarizeClipReasons(clip),
      transcript_text: summarizeClipTranscript(clip),
      filename: clip.filename!,
      subfolder: clip.subfolder!,
    })),
  );

  return materializedClips;
}

function buildTimelineItems(
  keepSpans: TimeSpan[],
  insertions: AutoCutInsertionPlan[],
  duration: number,
  replacementDuration: number,
) {
  const items: TimelineItem[] = [];
  const skippedInsertions: AutoCutInsertionPlan[] = [];
  const sortedInsertions = [...insertions].sort(compareTimeline);
  const normalizedKeepSpans = normalizeSpans(keepSpans, duration);
  let insertionIndex = 0;

  for (const keepSpan of normalizedKeepSpans) {
    while (
      insertionIndex < sortedInsertions.length &&
      sortedInsertions[insertionIndex].timestamp < keepSpan.start
    ) {
      skippedInsertions.push(sortedInsertions[insertionIndex]);
      insertionIndex += 1;
    }

    let cursor = keepSpan.start;

    while (
      insertionIndex < sortedInsertions.length &&
      sortedInsertions[insertionIndex].timestamp <= keepSpan.end
    ) {
      const insertion = sortedInsertions[insertionIndex];
      const insertionPoint = clampNumber(
        roundTime(insertion.timestamp),
        cursor,
        keepSpan.end,
      );

      if (insertionPoint - cursor >= MIN_KEEP_SPAN_SECONDS) {
        items.push({ kind: "source", start: cursor, end: insertionPoint });
      }

      const insertionSpanStart = insertionPoint;
      if (keepSpan.end - insertionSpanStart < replacementDuration) {
        skippedInsertions.push(insertion);
        insertionIndex += 1;
        continue;
      }

      const insertionSpanEnd = clampNumber(
        roundTime(insertionSpanStart + replacementDuration),
        insertionSpanStart,
        keepSpan.end,
      );

      if (insertionSpanEnd - insertionSpanStart < MIN_KEEP_SPAN_SECONDS) {
        skippedInsertions.push(insertion);
        insertionIndex += 1;
        continue;
      }

      items.push({
        kind: "insertion",
        insertion,
        start: insertionSpanStart,
        end: insertionSpanEnd,
      });
      cursor = insertionSpanEnd;
      insertionIndex += 1;
    }

    if (keepSpan.end - cursor >= MIN_KEEP_SPAN_SECONDS) {
      items.push({ kind: "source", start: cursor, end: keepSpan.end });
    }
  }

  while (insertionIndex < sortedInsertions.length) {
    skippedInsertions.push(sortedInsertions[insertionIndex]);
    insertionIndex += 1;
  }

  return { items, skippedInsertions };
}

function compareTimeline(a: { timestamp: number }, b: { timestamp: number }) {
  return a.timestamp - b.timestamp;
}

function timedWords(transcript: WhisperXTranscript) {
  return (transcript.segments ?? [])
    .flatMap((segment) => segment.words ?? [])
    .map((word) => {
      const text = word.word?.trim();
      if (!text || word.start === undefined || word.end === undefined) {
        return null;
      }

      return {
        text,
        start: word.start,
        end: word.end,
      };
    })
    .filter(
      (word): word is { text: string; start: number; end: number } =>
        word !== null,
    );
}

function detectSilenceSpans(transcript: WhisperXTranscript, duration: number) {
  const words = timedWords(transcript);
  if (words.length === 0) return [];

  const silences: AutoCutRemovalSpan[] = [];
  let previousEnd = 0;

  for (const word of words) {
    const gap = word.start - previousEnd;
    if (gap >= SILENCE_GAP_SECONDS) {
      silences.push({
        start: roundTime(previousEnd + SILENCE_EDGE_PADDING_SECONDS),
        end: roundTime(word.start - SILENCE_EDGE_PADDING_SECONDS),
        text: "[silence]",
        reason: "silence",
        confidence: 1,
      });
    }

    previousEnd = word.end;
  }

  const finalGap = duration - previousEnd;
  if (finalGap >= SILENCE_GAP_SECONDS) {
    silences.push({
      start: roundTime(previousEnd + SILENCE_EDGE_PADDING_SECONDS),
      end: roundTime(duration),
      text: "[silence]",
      reason: "silence",
      confidence: 1,
    });
  }

  return silences.filter(
    (span) => span.end - span.start >= MIN_KEEP_SPAN_SECONDS,
  );
}

function insertionClipDuration(job: { clip_duration?: number }) {
  return Math.max(2, job.clip_duration ?? Metadata.CLIP_DURATION);
}

function transitionDuration(job: { transition_duration?: number }) {
  return Math.max(1, job.transition_duration ?? Metadata.TRANSITION_DURATION);
}

function resolutionForJob(resolution?: string) {
  switch (resolution) {
    case "720p":
      return { width: 1280, height: 720 };
    case "1080p":
      return { width: 1920, height: 1080 };
    case "9_16_SD":
      return { width: 720, height: 1280 };
    case "9_16_HD":
      return { width: 1080, height: 1920 };
    case "480p":
    default:
      return { width: 640, height: 480 };
  }
}

async function getJob(jobId: string) {
  const job = await DB.Jobs.findById(jobId);
  Utils.assert(job, `Unable to find job ${jobId}`);
  return job;
}

function isAutocutJob(job: { workflow?: string | null }) {
  return job.workflow === "autocut";
}

async function createAutocutCompositionEvent(jobId: string, path: string) {
  const event = await DB.Events.create({
    id: Metadata.randomId(),
    jobId,
    mode: JobMode.Video,
    status: JobStatus.Complete,
    type: Event.NewVideoComposition,
    prompt: "autocut_timeline_composition",
  });

  await DB.Meta.create({
    event_id: event.id,
    filename: basename(path),
    subfolder: OUTPUT_SUBDIR,
    type: "output",
  });
}

async function renderTimelineComposition(jobId: string) {
  const manifest = await readManifest(jobId);
  Utils.assert(manifest, `Missing autocut manifest for ${jobId}`);
  Utils.assert(
    manifest.durationSeconds !== undefined,
    `Missing duration for ${jobId}`,
  );
  Utils.assert(manifest.insertionPlans, `Missing insertion plans for ${jobId}`);
  Utils.assert(manifest.keepSpans, `Missing keep spans for ${jobId}`);

  const sourceFile = manifest.inputPath;
  const duration = manifest.durationSeconds;
  const outputDir = Bun.env.OUTPUT_DIR;
  const job = await getJob(jobId);
  const replacementDuration = roundTime(
    transitionDuration(job) +
      insertionClipDuration(job) +
      transitionDuration(job),
  );

  Utils.assert(outputDir, "OUTPUT_DIR environment variable is not configured");
  await ensureDir(join(outputDir, OUTPUT_SUBDIR));

  const { items, skippedInsertions } = buildTimelineItems(
    manifest.keepSpans,
    manifest.insertionPlans,
    duration,
    replacementDuration,
  );
  if (skippedInsertions.length > 0) {
    Logger.warn(
      "Skipping autocut insertions that landed inside removed spans",
      {
        jobId,
        skippedInsertionIds: skippedInsertions.map((item) => item.insertionId),
      },
    );
  }

  Utils.assert(
    items.length > 0,
    "No timeline assets available for final composition",
  );

  const concatFile = join(workspaceDir(jobId), "timeline-concat.txt");
  const concatBody =
    items
      .map((item) => {
        if (item.kind === "source") {
          return `source ${item.start} ${item.end}`;
        }

        return `insert ${item.start} ${item.end} ${item.insertion.insertionId}`;
      })
      .join("\n") + "\n";
  await Bun.write(concatFile, concatBody);

  const outputFilename = `${jobId}-autocut.mp4`;
  const outputVideoPath = join(outputDir, OUTPUT_SUBDIR, outputFilename);

  await renderReplacementTimeline(jobId, sourceFile, outputVideoPath, items);

  await updateManifest(jobId, { outputVideoPath });
  await createAutocutCompositionEvent(jobId, outputVideoPath);
  return outputVideoPath;
}

async function renderReplacementTimeline(
  jobId: string,
  sourceFile: string,
  outputPath: string,
  items: TimelineItem[],
) {
  const job = await getJob(jobId);
  const fps = job.fps || Metadata.FPS;
  const { width, height } = resolutionForJob(job.resolution);
  const args = ["ffmpeg", "-y", "-i", sourceFile];
  const trimFilters: string[] = [];
  const concatInputs: string[] = [];
  let segmentIndex = 0;
  let replacementInputIndex = 1;

  for (const item of items) {
    if (item.kind === "source") {
      trimFilters.push(
        `[0:v]trim=start=${item.start}:end=${item.end},setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps},format=yuv420p,setsar=1[v${segmentIndex}]`,
        `[0:a]atrim=start=${item.start}:end=${item.end},asetpts=PTS-STARTPTS[a${segmentIndex}]`,
      );
      concatInputs.push(`[v${segmentIndex}][a${segmentIndex}]`);
      segmentIndex += 1;
      continue;
    }

    const { insertion } = item;
    Utils.assert(insertion.videoEventId, "Missing generated video event id");
    const clipPath = tmpVideoPath(jobId, insertion.videoEventId);

    const replacementPath = join(
      workspaceDir(jobId),
      `replacement-segment-${String(segmentIndex).padStart(3, "0")}.mp4`,
    );
    await renderInsertedVisualSegment(
      sourceFile,
      replacementPath,
      clipPath,
      item.start,
      item.end,
      transitionDuration(job),
      item.end - item.start,
      width,
      height,
      fps,
    );

    args.push("-i", replacementPath);
    trimFilters.push(
      `[${replacementInputIndex}:v]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps},format=yuv420p,setsar=1[v${segmentIndex}]`,
      `[0:a]atrim=start=${item.start}:end=${item.end},asetpts=PTS-STARTPTS[a${segmentIndex}]`,
    );
    concatInputs.push(`[v${segmentIndex}][a${segmentIndex}]`);
    replacementInputIndex += 1;
    segmentIndex += 1;
  }

  const filterComplex = `${trimFilters.join(";")};${concatInputs.join("")}concat=n=${segmentIndex}:v=1:a=1[v][a]`;
  const process = spawn({
    cmd: [
      ...args,
      "-filter_complex",
      filterComplex,
      "-map",
      "[v]",
      "-map",
      "[a]",
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

  const { stderr, exitCode } = await collectProcessOutput(process);
  if (exitCode !== 0) {
    throw new Error(
      `ffmpeg replacement timeline render failed: ${stderr.trim()}`,
    );
  }
}

async function renderInsertedVisualSegment(
  sourceFile: string,
  outputPath: string,
  clipPath: string,
  start: number,
  end: number,
  xfadeDuration: number,
  targetDuration: number,
  width: number,
  height: number,
  fps: number,
) {
  Utils.assert(
    targetDuration > 0,
    `Invalid insertion target duration: ${targetDuration}`,
  );
  const clipDuration = await Metadata.getMediaDurationFromPath(clipPath);
  Utils.assert(clipDuration > 0, "Invalid AI clip duration");
  Utils.assert(xfadeDuration > 0, "Invalid xfade duration");
  Utils.assert(
    targetDuration > xfadeDuration,
    "Replacement duration must exceed xfade duration",
  );
  const sourceInStart = roundTime(start);
  const sourceOutStart = roundTime(end - xfadeDuration);
  const ptsScale = targetDuration / clipDuration;

  const process = spawn({
    cmd: [
      "ffmpeg",
      "-y",
      "-ss",
      `${sourceInStart}`,
      "-t",
      `${roundTime(xfadeDuration)}`,
      "-i",
      sourceFile,
      "-i",
      clipPath,
      "-ss",
      `${sourceOutStart}`,
      "-t",
      `${roundTime(xfadeDuration)}`,
      "-i",
      sourceFile,
      "-an",
      "-filter_complex",
      `[0:v]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps},format=yuv420p,setsar=1[srcin];` +
      `[1:v]setpts=${ptsScale}*PTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps},format=yuv420p,setsar=1[clip];` +
      `[2:v]setpts=PTS-STARTPTS,scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps},format=yuv420p,setsar=1[srcout];` +
      `[srcin][clip]xfade=transition=fade:duration=${roundTime(xfadeDuration)}:offset=0[xf1];` +
      `[xf1][srcout]xfade=transition=fade:duration=${roundTime(xfadeDuration)}:offset=${roundTime(targetDuration - xfadeDuration)}[v]`,
      "-map",
      "[v]",
      "-t",
      `${roundTime(targetDuration)}`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    stdio: ["ignore", "pipe", "pipe"],
  });

  const { stderr, exitCode } = await collectProcessOutput(process);
  if (exitCode !== 0) {
    throw new Error(
      `ffmpeg inserted visual segment render failed: ${stderr.trim()}`,
    );
  }
}

async function trimMediaSegment(
  inputPath: string,
  outputPath: string,
  start: number,
  end: number,
) {
  Utils.assert(end > start, `Invalid trim range ${start}-${end}`);

  const process = spawn({
    cmd: [
      "ffmpeg",
      "-y",
      "-ss",
      `${roundTime(start)}`,
      "-to",
      `${roundTime(end)}`,
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

  const { stderr, exitCode } = await collectProcessOutput(process);
  if (exitCode !== 0) {
    throw new Error(`ffmpeg segment trim failed: ${stderr.trim()}`);
  }
}

function removedDuration(removals: AutoCutRemovalSpan[], duration: number) {
  return normalizeSpans(removals, duration).reduce(
    (sum, span) => sum + (span.end - span.start),
    0,
  );
}

async function writeState(state: AutoCutState) {
  await ensureDir(workspaceDir(state.jobId));
  await Bun.write(
    statusFile(state.jobId),
    `${JSON.stringify(state, null, 2)}\n`,
  );
}

async function updateState(jobId: string, patch: Partial<AutoCutState>) {
  const current = await AutoCutWorkflow.readState(jobId);
  if (!current) {
    throw new Error(`Missing autocut state for ${jobId}`);
  }

  const next: AutoCutState = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await writeState(next);
  return next;
}

async function runWhisperX(inputPath: string, jobId: string) {
  const whisperBinary = Bun.env.WHISPER_X;
  const whisperOutputDir = join(workspaceDir(jobId), "whisperx");
  await ensureDir(whisperOutputDir);

  if (!whisperBinary) {
    throw new Error("WHISPER_X environment variable is not configured");
  }

  const process = spawn({
    cmd: [
      whisperBinary,
      inputPath,
      "--output_dir",
      whisperOutputDir,
      "--output_format",
      "json",
    ],
    cwd: whisperOutputDir,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const { stdout, stderr, exitCode } = await collectProcessOutput(process);
  if (exitCode !== 0) {
    throw new Error(`WhisperX failed: ${(stderr || stdout).trim()}`);
  }

  const outputJsonPath = join(
    whisperOutputDir,
    `${basename(inputPath, extname(inputPath))}.json`,
  );

  const file = Bun.file(outputJsonPath);
  if (!(await file.exists())) {
    throw new Error(
      `WhisperX did not write expected JSON output to ${outputJsonPath}`,
    );
  }

  return outputJsonPath;
}

async function renderAutocutVideo(
  inputPath: string,
  outputPath: string,
  keepSpans: TimeSpan[],
) {
  const trimFilters: string[] = [];
  const concatInputs: string[] = [];

  for (const [index, span] of keepSpans.entries()) {
    trimFilters.push(
      `[0:v]trim=start=${span.start}:end=${span.end},setpts=PTS-STARTPTS[v${index}]`,
      `[0:a]atrim=start=${span.start}:end=${span.end},asetpts=PTS-STARTPTS[a${index}]`,
    );
    concatInputs.push(`[v${index}][a${index}]`);
  }

  const filterComplex = `${trimFilters.join(";")};${concatInputs.join("")}concat=n=${keepSpans.length}:v=1:a=1[v][a]`;

  const process = spawn({
    cmd: [
      "ffmpeg",
      "-y",
      "-i",
      inputPath,
      "-filter_complex",
      filterComplex,
      "-map",
      "[v]",
      "-map",
      "[a]",
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

  const { stderr, exitCode } = await collectProcessOutput(process);
  if (exitCode !== 0) {
    throw new Error(`ffmpeg autocut render failed: ${stderr.trim()}`);
  }
}

export namespace AutoCutWorkflow {
  export async function readState(jobId: string) {
    const file = Bun.file(statusFile(jobId));
    if (!(await file.exists())) {
      return null;
    }

    return (await file.json()) as AutoCutState;
  }

  export async function shouldHandleVideoEvent(event: JobEvent) {
    const job = await getJob(event.jobId);
    return isAutocutJob(job);
  }

  export async function handleVideoAssetSaved(
    event: VideoPromptEvent | TransitionPromptEvent,
  ) {
    const job = await getJob(event.jobId);
    if (!isAutocutJob(job)) return;

    const manifest = await readManifest(event.jobId);
    Utils.assert(manifest, `Missing autocut manifest for ${event.jobId}`);
    Utils.assert(
      manifest.insertionPlans,
      `Missing insertion plans for ${event.jobId}`,
    );

    const allReady = manifest.insertionPlans.every((plan) => plan.videoEventId);

    if (!allReady) return;

    const videoEvents = await Promise.all(
      manifest.insertionPlans
        .map((plan) => plan.videoEventId)
        .filter((id): id is string => Boolean(id))
        .map((id) => DB.Events.findById(id)),
    );

    if (!videoEvents.every((item) => item.status === JobStatus.Complete)) {
      return;
    }

    await updateState(event.jobId, {
      stage: "rendering",
      message: "Rendering final timeline composition with inserted clips.",
    });

    const outputVideoPath = await renderTimelineComposition(event.jobId);
    const outputFilename = basename(outputVideoPath);
    const removals = manifest.removalSpans ?? [];
    const cutClips = manifest.cutClips ?? [];

    await updateState(event.jobId, {
      stage: "complete",
      message: "Autocut complete.",
      cutClips,
      removals,
      removalCount: removals.length,
      removedDurationSeconds: roundTime(
        removedDuration(removals, manifest.durationSeconds!),
      ),
      insertionsCount: manifest.insertionPlans.length,
      outputVideoPath,
      outputVideoAssetPath: `/assets/${OUTPUT_SUBDIR}/${outputFilename}`,
    });

    await DB.Jobs.finalizeCompletedJobs();
  }

  export async function registerGeneratedVideoEvent(
    jobId: string,
    imageEventId: string,
    videoEventId: string,
  ) {
    const manifest = await readManifest(jobId);
    Utils.assert(manifest, `Missing autocut manifest for ${jobId}`);
    Utils.assert(
      manifest.insertionPlans,
      `Missing insertion plans for ${jobId}`,
    );

    const insertion = manifest.insertionPlans.find(
      (plan) => plan.imageEventId === imageEventId,
    );
    Utils.assert(
      insertion,
      `Missing insertion mapping for image event ${imageEventId}`,
    );
    insertion.videoEventId = videoEventId;

    await updateManifest(jobId, { insertionPlans: manifest.insertionPlans });
  }

  export async function enqueue(
    videoFile: File,
    options: {
      generateInsertClips: boolean;
      generationSettings?: AutoCutGenerationSettings;
    },
  ) {
    Utils.assert(videoFile, "Video file is required");
    Utils.assert(videoFile.size > 0, "Uploaded video file is empty");

    const job = await JobOrchestrator.create_job({
      original_prompt: `Autocut upload: ${videoFile.name}`,
      workflow: "autocut",
      fps: options.generationSettings?.fps ?? Metadata.FPS,
      resolution: options.generationSettings?.resolution ?? "720p",
      clip_duration:
        options.generationSettings?.clip_duration ?? Metadata.CLIP_DURATION,
      transition_duration:
        options.generationSettings?.transition_duration ??
        Metadata.TRANSITION_DURATION,
      image_model: options.generationSettings?.image_model ?? "z-image-turbo",
      video_model: options.generationSettings?.video_model ?? "wan2.2",
      style_preset: options.generationSettings?.style_preset ?? Presets.SYSTEM,
    });

    const jobId = job.id;
    const dir = workspaceDir(jobId);
    await ensureDir(dir);

    const safeName = slugifyFilename(
      videoFile.name || `upload${extname(videoFile.type || "")}`,
    );
    const inputPath = join(dir, safeName);
    await Bun.write(inputPath, videoFile);
    await TextGenerator.create_text_event(
      jobId,
      `Autocut source upload ${safeName}`,
    );

    await writeManifest(jobId, {
      inputPath,
      cutClips: [],
      generateInsertClips: options.generateInsertClips,
      insertionPlans: [],
    });

    const initialState: AutoCutState = {
      jobId,
      stage: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inputFilename: safeName,
      message: "Upload received. Preparing autocut workflow.",
      warnings: [],
    };

    await writeState(initialState);
    void process(jobId, inputPath, options.generateInsertClips);

    return { jobId };
  }

  async function process(
    jobId: string,
    inputPath: string,
    generateInsertClips: boolean,
  ) {
    try {
      Utils.assert(
        inputPath.startsWith(TMP_ROOT),
        "Autocut input must live in /tmp workspace",
      );

      await updateState(jobId, {
        stage: "transcribing",
        message: "Transcribing the video.",
      });

      const whisperJsonPath = await runWhisperX(inputPath, jobId);
      const transcript = (await Bun.file(
        whisperJsonPath,
      ).json()) as WhisperXTranscript;
      Utils.assert(
        Array.isArray(transcript.segments),
        "WhisperX JSON is missing segments",
      );
      const duration = await Metadata.getMediaDurationFromPath(inputPath);
      const silenceRemovals = detectSilenceSpans(transcript, duration);
      await updateManifest(jobId, {
        whisperJsonPath,
        durationSeconds: duration,
        transcriptLanguage: transcript.language,
      });

      await updateState(jobId, {
        stage: "analyzing",
        message:
          "Analyzing transcript for filler words, restarts, and mistakes.",
        transcriptLanguage: transcript.language,
        transcriptWordCount: timedWords(transcript).length,
        videoDurationSeconds: roundTime(duration),
      });

      const llmPlan =
        await PromptGenerator.autocut_plan_from_whisperx_json(whisperJsonPath);
      const insertionPlan = generateInsertClips
        ? await PromptGenerator.autocut_insertions_from_whisperx_json(
            whisperJsonPath,
            3,
          )
        : {
            insertions: [],
            warnings: [],
          };
      const mergedRemovals = dedupeRemovals(
        [...silenceRemovals, ...llmPlan.removals],
        duration,
      );
      const keepSpans = invertSpans(mergedRemovals, duration);
      const cutClips = await materializeCutClips(
        jobId,
        inputPath,
        buildCutClips(mergedRemovals, duration),
      );
      const insertionPlans: AutoCutInsertionPlan[] = insertionPlan.insertions
        .map((item) => ({
          insertionId: Metadata.randomId(),
          timestamp: item.timestamp,
          prompt: item.prompt,
          transcriptContext: item.transcriptContext,
        }))
        .sort(compareTimeline);

      await updateManifest(jobId, {
        cutClips,
        generateInsertClips,
        removalSpans: mergedRemovals,
        keepSpans,
        insertionPlans,
      });

      if (keepSpans.length === 0) {
        throw new Error(
          "Autocut removed the full video. Refine the prompt or transcript analysis.",
        );
      }

      const job = await getJob(jobId);

      const outputDir = Bun.env.OUTPUT_DIR;
      if (!outputDir) {
        throw new Error("OUTPUT_DIR environment variable is not configured");
      }

      await ensureDir(join(outputDir, OUTPUT_SUBDIR));

      if (insertionPlans.length === 0) {
        await updateState(jobId, {
          stage: "rendering",
          message: "Rendering final cut video.",
        });

        const outputFilename = `${jobId}-autocut.mp4`;
        const outputVideoPath = join(outputDir, OUTPUT_SUBDIR, outputFilename);
        await renderAutocutVideo(inputPath, outputVideoPath, keepSpans);
        await updateManifest(jobId, { outputVideoPath });
        await createAutocutCompositionEvent(jobId, outputVideoPath);

        const removedSeconds = roundTime(
          removedDuration(mergedRemovals, duration),
        );
        const analysisPath = join(workspaceDir(jobId), "cut-plan.json");
        await Bun.write(
          analysisPath,
          `${JSON.stringify(
            {
              removals: mergedRemovals,
              cutClips,
              keepSpans,
              insertions: insertionPlans,
              warnings: [...llmPlan.warnings, ...insertionPlan.warnings],
            },
            null,
            2,
          )}\n`,
        );

        await updateState(jobId, {
          stage: "complete",
          message: "Autocut complete.",
          cutClips,
          removals: mergedRemovals,
          removalCount: mergedRemovals.length,
          removedDurationSeconds: removedSeconds,
          insertionsCount: 0,
          outputVideoPath,
          outputVideoAssetPath: `/assets/${OUTPUT_SUBDIR}/${outputFilename}`,
          warnings: [...llmPlan.warnings, ...insertionPlan.warnings],
        });
        await DB.Jobs.finalizeCompletedJobs();
        return;
      }

      for (const [index, insertion] of insertionPlans.entries()) {
        const imageEvent = await PromptGenerator.styled_img_to_event(
          jobId,
          JobMode.Video,
          insertion.prompt,
          job.style_preset as Presets | undefined,
          index,
        );
        Utils.assert(
          imageEvent,
          `Failed to schedule styled insert image for ${jobId}`,
        );
        insertion.imageEventId = imageEvent.id;
      }

      await updateManifest(jobId, { insertionPlans });
      void QueueManager.pump();

      const removedSeconds = roundTime(
        removedDuration(mergedRemovals, duration),
      );
      const analysisPath = join(workspaceDir(jobId), "cut-plan.json");
      await Bun.write(
        analysisPath,
        `${JSON.stringify(
          {
            removals: mergedRemovals,
            cutClips,
            keepSpans,
            insertions: insertionPlans,
            warnings: [...llmPlan.warnings, ...insertionPlan.warnings],
          },
          null,
          2,
        )}\n`,
      );

      await updateState(jobId, {
        stage: "rendering",
        message: generateInsertClips
          ? "Generating timeline insert clips and transitions."
          : "Rendering final cut video.",
        cutClips,
        removals: mergedRemovals,
        removalCount: mergedRemovals.length,
        removedDurationSeconds: removedSeconds,
        insertionsCount: insertionPlans.length,
        warnings: [...llmPlan.warnings, ...insertionPlan.warnings],
      });
    } catch (error) {
      Logger.error("Autocut workflow failed", { jobId, error });

      await updateState(jobId, {
        stage: "failed",
        message: "Autocut failed.",
        error: error instanceof Error ? error.message : String(error),
      });

      await DB.Jobs.failJob(jobId).catch(() => null);
    }
  }
}
