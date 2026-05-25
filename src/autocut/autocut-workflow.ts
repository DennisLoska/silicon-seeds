import { mkdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { spawn } from "bun";
import { Logger } from "../logger/logger";
import { Metadata } from "../meta/meta";
import { PromptGenerator, type AutoCutRemovalSpan } from "../prompts/prompt-generator";
import { JobOrchestrator } from "../jobs/jobs";
import { TextGenerator } from "../text/text-generator";
import { ImageGenerator } from "../image/image-generator";
import { VideoGenerator } from "../video/video-generator";
import { DB } from "../db/db";
import { Event, JobMode, JobStatus, type ImagePromptEvent, type JobEvent, type TransitionPromptEvent, type VideoPromptEvent } from "../events/events";
import { Presets } from "../styles/presets";
import { Utils } from "../utils/utils";

const TMP_ROOT = "/tmp/silicon-seeds-autocut";
const OUTPUT_SUBDIR = "autocut";
const MIN_KEEP_SPAN_SECONDS = 0.08;
const SILENCE_GAP_SECONDS = 0.8;
const SILENCE_EDGE_PADDING_SECONDS = 0.04;

export type AutoCutStage =
  | "queued"
  | "extracting_audio"
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
  incomingTransitionEventId?: string;
  outgoingTransitionEventId?: string;
}

interface AutoCutManifest {
  inputPath: string;
  audioPath?: string;
  whisperJsonPath?: string;
  durationSeconds?: number;
  transcriptLanguage?: string;
  removalSpans?: AutoCutRemovalSpan[];
  keepSpans?: TimeSpan[];
  insertionPlans?: AutoCutInsertionPlan[];
  outputVideoPath?: string;
}

function roundTime(value: number) {
  return Math.round(value * 1000) / 1000;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function slugifyFilename(name: string) {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "upload";
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

  return await file.json() as AutoCutManifest;
}

async function writeManifest(jobId: string, manifest: AutoCutManifest) {
  await ensureDir(workspaceDir(jobId));
  await Bun.write(manifestFile(jobId), `${JSON.stringify(manifest, null, 2)}\n`);
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
    .filter((word): word is { text: string; start: number; end: number } => word !== null);
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

  return silences.filter((span) => span.end - span.start >= MIN_KEEP_SPAN_SECONDS);
}

function insertionClipDuration(job: { clip_duration?: number }) {
  return Math.max(2, job.clip_duration ?? Metadata.CLIP_DURATION);
}

function transitionDuration(job: { transition_duration?: number }) {
  return Math.max(1, job.transition_duration ?? Metadata.TRANSITION_DURATION);
}

async function extractVideoFrame(inputPath: string, timestamp: number, outputPath: string) {
  const process = spawn({
    cmd: [
      "ffmpeg",
      "-y",
      "-ss",
      `${roundTime(timestamp)}`,
      "-i",
      inputPath,
      "-frames:v",
      "1",
      outputPath,
    ],
    stdio: ["ignore", "pipe", "pipe"],
  });

  const { stderr, exitCode } = await collectProcessOutput(process);
  if (exitCode !== 0) {
    throw new Error(`ffmpeg frame extraction failed: ${stderr.trim()}`);
  }
}

async function extractBoundaryFramesForInsertion(
  jobId: string,
  insertion: AutoCutInsertionPlan,
  duration: number,
  clipDuration: number,
) {
  const beforeFrame = join(workspaceDir(jobId), `${insertion.insertionId}-before.png`);
  const afterFrame = join(workspaceDir(jobId), `${insertion.insertionId}-after.png`);
  const beforeTimestamp = clampNumber(insertion.timestamp, 0, duration);
  const afterTimestamp = clampNumber(insertion.timestamp + 0.05, 0, duration);

  await extractVideoFrame((await readManifest(jobId))!.inputPath, beforeTimestamp, beforeFrame);
  await extractVideoFrame((await readManifest(jobId))!.inputPath, afterTimestamp, afterFrame);

  return { beforeFrame, afterFrame };
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
  Utils.assert(manifest.durationSeconds !== undefined, `Missing duration for ${jobId}`);
  Utils.assert(manifest.insertionPlans, `Missing insertion plans for ${jobId}`);

  const job = await getJob(jobId);
  const clipDuration = insertionClipDuration(job);
  const transDuration = transitionDuration(job);
  const sortedInsertions = [...manifest.insertionPlans].sort(compareTimeline);
  const sourceFile = manifest.inputPath;
  const duration = manifest.durationSeconds;
  const outputDir = Bun.env.OUTPUT_DIR;

  Utils.assert(outputDir, "OUTPUT_DIR environment variable is not configured");
  await ensureDir(join(outputDir, OUTPUT_SUBDIR));

  const originalSegments: string[] = [];
  let cursor = 0;

  for (const [index, insertion] of sortedInsertions.entries()) {
    const start = clampNumber(insertion.timestamp, cursor, duration);
    const end = start;
    const segmentPath = join(workspaceDir(jobId), `original-segment-${String(index).padStart(3, "0")}.mp4`);

    if (start - cursor >= MIN_KEEP_SPAN_SECONDS) {
      await trimMediaSegment(sourceFile, segmentPath, cursor, start);
      originalSegments.push(segmentPath);
    }

    cursor = clampNumber(end, cursor, duration);
  }

  const trailingSegmentPath = join(workspaceDir(jobId), `original-segment-tail.mp4`);
  if (duration - cursor >= MIN_KEEP_SPAN_SECONDS) {
    await trimMediaSegment(sourceFile, trailingSegmentPath, cursor, duration);
    originalSegments.push(trailingSegmentPath);
  }

  const orderedAssets: string[] = [];

  for (const [index, insertion] of sortedInsertions.entries()) {
    const originalSegment = originalSegments[index];
    if (originalSegment) {
      orderedAssets.push(originalSegment);
    }

    Utils.assert(insertion.incomingTransitionEventId, "Missing incoming transition event id");
    Utils.assert(insertion.videoEventId, "Missing generated video event id");
    Utils.assert(insertion.outgoingTransitionEventId, "Missing outgoing transition event id");

    orderedAssets.push(tmpVideoPath(jobId, insertion.incomingTransitionEventId));
    orderedAssets.push(tmpVideoPath(jobId, insertion.videoEventId));
    orderedAssets.push(tmpVideoPath(jobId, insertion.outgoingTransitionEventId));
  }

  const tailSegment = originalSegments.at(-1);
  if (tailSegment && !orderedAssets.includes(tailSegment)) {
    orderedAssets.push(tailSegment);
  }

  Utils.assert(orderedAssets.length > 0, "No timeline assets available for final composition");

  const concatFile = join(workspaceDir(jobId), "timeline-concat.txt");
  const concatBody = orderedAssets.map((asset) => `file '${asset}'`).join("\n") + "\n";
  await Bun.write(concatFile, concatBody);

  const outputFilename = `${jobId}-autocut.mp4`;
  const outputVideoPath = join(outputDir, OUTPUT_SUBDIR, outputFilename);

  const process = spawn({
    cmd: [
      "ffmpeg",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatFile,
      "-c",
      "copy",
      outputVideoPath,
    ],
    stdio: ["ignore", "pipe", "pipe"],
  });

  const { stderr, exitCode } = await collectProcessOutput(process);
  if (exitCode !== 0) {
    throw new Error(`ffmpeg timeline concat failed: ${stderr.trim()}`);
  }

  await updateManifest(jobId, { outputVideoPath });
  await createAutocutCompositionEvent(jobId, outputVideoPath);
  return outputVideoPath;
}

async function trimMediaSegment(inputPath: string, outputPath: string, start: number, end: number) {
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
  return normalizeSpans(removals, duration)
    .reduce((sum, span) => sum + (span.end - span.start), 0);
}

async function writeState(state: AutoCutState) {
  await ensureDir(workspaceDir(state.jobId));
  await Bun.write(statusFile(state.jobId), `${JSON.stringify(state, null, 2)}\n`);
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

async function runFfmpeg(inputPath: string, outputPath: string) {
  const process = spawn({
    cmd: [
      "ffmpeg",
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-c:a",
      "pcm_s16le",
      outputPath,
    ],
    stdio: ["ignore", "pipe", "pipe"],
  });

  const { stderr, exitCode } = await collectProcessOutput(process);
  if (exitCode !== 0) {
    throw new Error(`ffmpeg audio extraction failed: ${stderr.trim()}`);
  }
}

async function runWhisperX(audioPath: string, jobId: string) {
  const whisperBinary = Bun.env.WHISPER_X;
  const whisperOutputDir = join(workspaceDir(jobId), "whisperx");
  await ensureDir(whisperOutputDir);

  if (!whisperBinary) {
    throw new Error("WHISPER_X environment variable is not configured");
  }

  const process = spawn({
    cmd: [
      whisperBinary,
      audioPath,
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
    `${basename(audioPath, extname(audioPath))}.json`,
  );

  const file = Bun.file(outputJsonPath);
  if (!(await file.exists())) {
    throw new Error(`WhisperX did not write expected JSON output to ${outputJsonPath}`);
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

    return await file.json() as AutoCutState;
  }

  export async function shouldHandleVideoEvent(event: JobEvent) {
    const job = await getJob(event.jobId);
    return isAutocutJob(job);
  }

  export async function handleVideoAssetSaved(event: VideoPromptEvent | TransitionPromptEvent) {
    const job = await getJob(event.jobId);
    if (!isAutocutJob(job)) return;

    const manifest = await readManifest(event.jobId);
    Utils.assert(manifest, `Missing autocut manifest for ${event.jobId}`);
    Utils.assert(manifest.insertionPlans, `Missing insertion plans for ${event.jobId}`);

    if (event.type === Event.NewVideoPrompt) {
      const insertion = manifest.insertionPlans.find((plan) => plan.videoEventId === event.id);
      Utils.assert(insertion, `Missing insertion mapping for generated video ${event.id}`);

      const { beforeFrame, afterFrame } = await extractBoundaryFramesForInsertion(
        event.jobId,
        insertion,
        manifest.durationSeconds!,
        insertionClipDuration(job),
      );

      const [generatedFirst, generatedLast] = await VideoGenerator.video_frames_for_asset(
        event.jobId,
        event.id,
        tmpVideoPath(event.jobId, event.id),
      );

      const incoming = await VideoGenerator.schedule_transition({
        jobId: event.jobId,
        prompt: `${insertion.prompt}. Seamlessly transition from the real source footage into the generated insert clip.`,
        startImg: beforeFrame,
        endImg: generatedFirst,
      });

      const outgoing = await VideoGenerator.schedule_transition({
        jobId: event.jobId,
        prompt: `${insertion.prompt}. Seamlessly transition from the generated insert clip back into the real source footage.`,
        startImg: generatedLast,
        endImg: afterFrame,
      });

      insertion.incomingTransitionEventId = incoming.id;
      insertion.outgoingTransitionEventId = outgoing.id;
      await updateManifest(event.jobId, { insertionPlans: manifest.insertionPlans });
      return;
    }

    const allReady = manifest.insertionPlans.every((plan) =>
      plan.videoEventId && plan.incomingTransitionEventId && plan.outgoingTransitionEventId,
    );

    if (!allReady) return;

    const transitionIds = manifest.insertionPlans.flatMap((plan) => [
      plan.incomingTransitionEventId,
      plan.outgoingTransitionEventId,
    ]).filter((id): id is string => Boolean(id));

    const transitionEvents = await Promise.all(
      transitionIds.map((id) => DB.Events.findById(id)),
    );

    if (!transitionEvents.every((item) => item.status === JobStatus.Complete)) {
      return;
    }

    await updateState(event.jobId, {
      stage: "rendering",
      message: "Rendering final timeline composition with inserted clips and transitions.",
    });

    const outputVideoPath = await renderTimelineComposition(event.jobId);
    const outputFilename = basename(outputVideoPath);
    const removals = manifest.removalSpans ?? [];

    await updateState(event.jobId, {
      stage: "complete",
      message: "Autocut complete.",
      removals,
      removalCount: removals.length,
      removedDurationSeconds: roundTime(removedDuration(removals, manifest.durationSeconds!)),
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
    Utils.assert(manifest.insertionPlans, `Missing insertion plans for ${jobId}`);

    const insertion = manifest.insertionPlans.find((plan) => plan.imageEventId === imageEventId);
    Utils.assert(insertion, `Missing insertion mapping for image event ${imageEventId}`);
    insertion.videoEventId = videoEventId;

    await updateManifest(jobId, { insertionPlans: manifest.insertionPlans });
  }

  export async function enqueue(videoFile: File) {
    Utils.assert(videoFile, "Video file is required");
    Utils.assert(videoFile.size > 0, "Uploaded video file is empty");

    const job = await JobOrchestrator.create_job({
      original_prompt: `Autocut upload: ${videoFile.name}`,
      workflow: "autocut",
      fps: Metadata.FPS,
      resolution: "720p",
      clip_duration: Metadata.CLIP_DURATION,
      transition_duration: Metadata.TRANSITION_DURATION,
      image_model: "z-image-turbo",
      video_model: "wan2.2",
      style_preset: Presets.SYSTEM,
    });

    const jobId = job.id;
    const dir = workspaceDir(jobId);
    await ensureDir(dir);

    const safeName = slugifyFilename(videoFile.name || `upload${extname(videoFile.type || "")}`);
    const inputPath = join(dir, safeName);
    await Bun.write(inputPath, videoFile);
    await TextGenerator.create_text_event(jobId, `Autocut source upload ${safeName}`);

    await writeManifest(jobId, {
      inputPath,
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
    void process(jobId, inputPath);

    return { jobId };
  }

  async function process(jobId: string, inputPath: string) {
    try {
      Utils.assert(inputPath.startsWith(TMP_ROOT), "Autocut input must live in /tmp workspace");

      await updateState(jobId, {
        stage: "extracting_audio",
        message: "Extracting audio track with ffmpeg.",
      });

      const audioPath = join(workspaceDir(jobId), "source-audio.wav");
      await runFfmpeg(inputPath, audioPath);
      await updateManifest(jobId, { audioPath });

      await updateState(jobId, {
        stage: "transcribing",
        message: "Running WhisperX transcription.",
      });

      const whisperJsonPath = await runWhisperX(audioPath, jobId);
      const transcript = await Bun.file(whisperJsonPath).json() as WhisperXTranscript;
      Utils.assert(Array.isArray(transcript.segments), "WhisperX JSON is missing segments");
      const duration = await Metadata.getMediaDurationFromPath(inputPath);
      const silenceRemovals = detectSilenceSpans(transcript, duration);
      await updateManifest(jobId, {
        whisperJsonPath,
        durationSeconds: duration,
        transcriptLanguage: transcript.language,
      });

      await updateState(jobId, {
        stage: "analyzing",
        message: "Analyzing transcript for filler words, restarts, and mistakes.",
        transcriptLanguage: transcript.language,
        transcriptWordCount: timedWords(transcript).length,
        videoDurationSeconds: roundTime(duration),
      });

      const llmPlan = await PromptGenerator.autocut_plan_from_whisperx_json(whisperJsonPath);
      const insertionPlan = await PromptGenerator.autocut_insertions_from_whisperx_json(
        whisperJsonPath,
        3,
      );
      const mergedRemovals = dedupeRemovals(
        [...silenceRemovals, ...llmPlan.removals],
        duration,
      );
      const keepSpans = invertSpans(mergedRemovals, duration);
      const insertionPlans: AutoCutInsertionPlan[] = insertionPlan.insertions
        .map((item) => ({
          insertionId: Metadata.randomId(),
          timestamp: item.timestamp,
          prompt: item.prompt,
          transcriptContext: item.transcriptContext,
        }))
        .sort(compareTimeline);

      await updateManifest(jobId, {
        removalSpans: mergedRemovals,
        keepSpans,
        insertionPlans,
      });

      if (keepSpans.length === 0) {
        throw new Error("Autocut removed the full video. Refine the prompt or transcript analysis.");
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

        const removedSeconds = roundTime(removedDuration(mergedRemovals, duration));
        const analysisPath = join(workspaceDir(jobId), "cut-plan.json");
        await Bun.write(
          analysisPath,
          `${JSON.stringify({
            removals: mergedRemovals,
            keepSpans,
            insertions: insertionPlans,
            warnings: [...llmPlan.warnings, ...insertionPlan.warnings],
          }, null, 2)}\n`,
        );

        await updateState(jobId, {
          stage: "complete",
          message: "Autocut complete.",
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
        const imageEvent = await ImageGenerator.schedule_image({
          jobId,
          mode: JobMode.Video,
          prompt: insertion.prompt,
          index,
        });
        insertion.imageEventId = imageEvent.id;
      }

      await updateManifest(jobId, { insertionPlans });

      const removedSeconds = roundTime(removedDuration(mergedRemovals, duration));
      const analysisPath = join(workspaceDir(jobId), "cut-plan.json");
      await Bun.write(
        analysisPath,
        `${JSON.stringify({
          removals: mergedRemovals,
          keepSpans,
          insertions: insertionPlans,
          warnings: [...llmPlan.warnings, ...insertionPlan.warnings],
        }, null, 2)}\n`,
      );

      await updateState(jobId, {
        stage: "rendering",
        message: "Generating timeline insert clips and transitions.",
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
