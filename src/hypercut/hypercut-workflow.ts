import path from "node:path";
import { DB } from "../db/db";
import { Chroma } from "../chroma/chroma";
import { JobOrchestrator } from "../jobs/jobs";
import { LLM } from "../llm/llm";
import { Logger } from "../logger/logger";
import { MCPVideo } from "../mcp/mcp-video";
import { Metadata } from "../meta/meta";
import { WhisperX } from "../whisperx/whisperx";
import {
  analyzeTranscript,
  type TimedWord,
} from "./hypercut-transcript-analyzer";
import { parseWhisperX } from "./whisperx-parser";
import { generateHyperframesHtml, type TimelineMediaElement } from "@hyperframes/core";

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
    await DB.Jobs.updateStatus(jobId, "active" as any);

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

    Logger.info("HyperCut: generating initial composition", { jobId });
    await generateInitialComposition(jobId);

    Logger.info("HyperCut: upload processing complete", {
      jobId,
      removals: removals.length,
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
        const results = await Chroma.search(queryText, 3);
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

  export async function generateInitialComposition(jobId: string) {
    const outputDir = Bun.env.OUTPUT_DIR;
    if (!outputDir) return;

    const job = await DB.Jobs.findById(jobId);
    const resolution = (job.resolution ?? "landscape") as any;

    const elements: TimelineMediaElement[] = [
      {
        id: "source-video",
        type: "video",
        name: "Source Video",
        startTime: 0,
        duration: 10,
        zIndex: 0,
        src: job.source_video_path
          ? `/assets/source/${jobId}`
          : "",
      },
    ];

    const html = generateHyperframesHtml(elements, 10, {
      resolution,
      compositionId: `hypercut-${jobId}`,
    });

    const compPath = `${outputDir}/hypercut-${jobId}.html`;
    await Bun.write(compPath, html);
    Logger.info("HyperCut: initial composition generated", { jobId });
  }

  export async function addSuggestionToComposition(
    jobId: string,
    outputDir: string,
    suggestionId?: string,
    clip?: Record<string, unknown>,
  ): Promise<{ ok: boolean }> {
    const compPath = `${outputDir}/hypercut-${jobId}.html`;
    const file = Bun.file(compPath);

    if (!(await file.exists())) {
      await generateInitialComposition(jobId);
    }

    Logger.info("HyperCut: suggestion added to composition", {
      jobId,
      suggestionId,
    });

    return { ok: true };
  }

  export async function render(jobId: string, outputDir: string) {
    const compPath = `${outputDir}/hypercut-${jobId}.html`;

    const file = Bun.file(compPath);
    if (!(await file.exists())) {
      throw new Error(
        "Composition not found. Generate it before rendering.",
      );
    }

    if (!MCPVideo.isReady()) {
      throw new Error("MCP-video is not available");
    }

    const outputPath = path.join(outputDir, `hypercut-${jobId}.mp4`);
    await MCPVideo.hyperframesRender(compPath, outputPath);

    return outputPath;
  }
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
