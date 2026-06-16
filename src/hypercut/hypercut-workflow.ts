import path from "node:path";
import { DB } from "../db/db";
import { Chroma } from "../chroma/chroma";
import { JobOrchestrator } from "../jobs/jobs";
import { LLM } from "../llm/llm";
import { Logger } from "../logger/logger";

import { Metadata } from "../meta/meta";
import { JobLifecycleStatus } from "../events/events";
import { WhisperX } from "../whisperx/whisperx";
import {
  analyzeTranscript,
  type TimedWord,
  type RemovalSpan,
} from "./hypercut-transcript-analyzer";
import { parseWhisperX } from "./whisperx-parser";
import { generateHyperframesHtml, toFps, type TimelineMediaElement } from "@hyperframes/core";
import { createRenderJob, executeRenderJob } from "@hyperframes/producer";
import { AgenticEditor } from "./agentic-editor";

export interface HyperCutJobInput {
  original_prompt?: string;
  resolution?: string;
  video_model?: string;
}

export namespace HyperCutWorkflow {
  export async function createJob(input: HyperCutJobInput) {
    return await JobOrchestrator.create_job({
      workflow: "hypercut",
      original_prompt: input.original_prompt,
      resolution: input.resolution,
      video_model: input.video_model,
    });
  }

  export async function processUpload(jobId: string, videoPath: string) {
    await DB.Jobs.updateStatus(jobId, JobLifecycleStatus.Active);

    const job = await DB.Jobs.findById(jobId);
    if (!job.source_video_path) {
      await dbUpdateJobSourceVideoPath(jobId, videoPath);
    }

    Logger.info("HyperCut: running WhisperX", { jobId });
    const whisperJsonPath = await WhisperX.run(videoPath);

    Logger.info("HyperCut: parsing transcript", { jobId });
    const words = await parseWhisperX(whisperJsonPath);

    Logger.info("HyperCut: analyzing transcript for removals", { jobId });
    const removals = analyzeTranscript(words);
    for (const span of removals) {
      await DB.Hypercut.insertSuggestion({
        id: Metadata.randomId(),
        job_id: jobId,
        source_type: "autocut_cut",
        asset_id: null,
        text_content: span.text,
        transcript_anchor_start: span.start,
        transcript_anchor_end: span.end,
        score: null,
        status: "pending",
        created_at: new Date().toISOString(),
      });
    }

    Logger.info("HyperCut: generating content suggestions", { jobId });
    await generateContentSuggestions(jobId, words);

    Logger.info("HyperCut: getting video duration", { jobId });
    const duration = await Metadata.getMediaDurationFromPath(videoPath);

    Logger.info("HyperCut: generating initial composition", { jobId });
    await generateInitialComposition(jobId, removals, duration);

    await DB.Jobs.updateStatus(jobId, JobLifecycleStatus.Complete);
    AgenticEditor.clearHistory(jobId);

    Logger.info("HyperCut: upload processing complete", {
      jobId,
      removals: removals.length,
      duration,
    });
  }

  export async function generateContentSuggestions(
    jobId: string,
    words: TimedWord[],
  ) {
    const segments = groupWordsIntoSegments(words, 20);
    for (const segment of segments) {
      const queryText = await summarizeSegment(segment);
      try {
        const results = await Chroma.search(queryText, 5);
        for (const result of results) {
          await DB.Hypercut.insertSuggestion({
            id: Metadata.randomId(),
            job_id: jobId,
            source_type: result.type as "image" | "video" | "text",
            asset_id: result.id,
            text_content: null,
            transcript_anchor_start: segment[0]?.start ?? 0,
            transcript_anchor_end: segment[segment.length - 1]?.end ?? 0,
            score: result.score ?? 0,
            status: "pending",
            created_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.error("HyperCut: ChromaDB search failed", { jobId, message });
      }
    }
  }

  export async function generateInitialComposition(
    jobId: string,
    removals: RemovalSpan[] = [],
    duration: number = 10,
  ) {
    const outputDir = Bun.env.OUTPUT_DIR;
    if (!outputDir) return;

    const job = await DB.Jobs.findById(jobId);
    const resolution = (job.resolution ?? "landscape") as any;
    const src = job.source_video_path
      ? `/assets/source/${jobId}`
      : "";

    const elements = buildChunkedClips(src, jobId, removals, duration);
    const totalDuration = elements.reduce((sum, el) => sum + el.duration, 0);

    const html = generateHyperframesHtml(elements, totalDuration, {
      resolution,
      compositionId: `hypercut-${jobId}`,
    });

    const compPath = `${outputDir}/hypercut-${jobId}.html`;
    await Bun.write(compPath, html);
    Logger.info("HyperCut: initial composition generated", {
      jobId,
      clips: elements.length,
      duration: totalDuration,
    });
  }

  export async function addSuggestionToComposition(
    jobId: string,
    outputDir: string,
    suggestionId?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!suggestionId) {
      return { ok: false, error: "suggestionId required" };
    }

    Logger.info("HyperCut: suggestion composition request", {
      jobId,
      suggestionId,
    });

    return {
      ok: false,
      error:
        "Use the AI Editor (right sidebar) to apply suggestions to the composition. The Add-to-Timeline button is deprecated.",
    };
  }

  export async function render(jobId: string, outputDir: string) {
    const compPath = `${outputDir}/hypercut-${jobId}.html`;

    const file = Bun.file(compPath);
    if (!(await file.exists())) {
      throw new Error(
        "Composition not found. Generate it before rendering.",
      );
    }

    const outputPath = path.join(outputDir, `hypercut-${jobId}.mp4`);

    const job = createRenderJob({
      fps: 30,
      quality: "standard",
      entryFile: `hypercut-${jobId}.html`,
      format: "mp4",
    });

    await executeRenderJob(job, outputDir, outputPath);

    return outputPath;
  }
}

function buildChunkedClips(
  src: string,
  jobId: string,
  removals: RemovalSpan[],
  duration: number,
): TimelineMediaElement[] {
  const sorted = [...removals]
    .filter((r) => r.start >= 0 && r.end <= duration && r.end > r.start)
    .sort((a, b) => a.start - b.start);

  const clips: TimelineMediaElement[] = [];
  let cursor = 0;
  let clipIndex = 0;

  function addClip(segStart: number, segEnd: number, label: string) {
    const segDuration = roundTo(segEnd - segStart, 3);
    if (segDuration < 0.08) return; // skip sub-frame segments

    clips.push({
      id: `seg-${clipIndex}`,
      type: "video",
      name: label,
      startTime: cursor,
      duration: segDuration,
      zIndex: 0,
      src,
      mediaStartTime: roundTo(segStart, 3),
      sourceDuration: segDuration,
    });
    cursor += segDuration;
    clipIndex++;
  }

  for (const removal of sorted) {
    // Good segment before this removal (if any)
    if (cursor < removal.start) {
      addClip(cursor, removal.start, `Segment ${clipIndex + 1}`);
    }

    // Bad segment for the removal itself — label by reason
    const label = labelForRemoval(removal);
    addClip(removal.start, removal.end, label);

    // Merge overlapping removals by advancing cursor past current end
    cursor = Math.max(cursor, removal.end);
  }

  // Final good segment (if any)
  if (cursor < duration) {
    addClip(cursor, duration, `Segment ${clipIndex + 1}`);
  }

  return clips;
}

function labelForRemoval(removal: RemovalSpan): string {
  switch (removal.reason) {
    case "filler":
      return `[FILLER] ${removal.text}`;
    case "pause":
      return `[PAUSE] ${roundTo(removal.end - removal.start, 2)}s gap`;
    case "restart":
      return `[RESTART] ${removal.text}`;
    default:
      return `[EDIT] ${removal.text}`;
  }
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

async function dbUpdateJobSourceVideoPath(jobId: string, videoPath: string) {
  await DB.db
    .updateTable("jobs")
    .set({ source_video_path: videoPath })
    .where("id", "=", jobId)
    .execute();
}

function groupWordsIntoSegments(
  words: TimedWord[],
  maxWords: number,
): TimedWord[][] {
  const segments: TimedWord[][] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    segments.push(words.slice(i, i + maxWords));
  }
  return segments;
}

async function summarizeSegment(words: TimedWord[]): Promise<string> {
  const text = words.map((w) => w.word).join(" ");
  const res = await LLM.message(
    `Summarize this video transcript segment in one sentence suitable for searching a visual content library. Only return the search query.\n\n${text}`,
  );
  return res?.content?.trim() ?? text;
}
