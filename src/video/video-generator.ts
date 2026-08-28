import { comfyClient, ModelVariant } from "../comfyui/comfyui-client";
import {
  Event,
  JobEvent,
  JobMode,
  VideoPromptEvent,
  TransitionPromptEvent,
  VideoCompostionEvent,
  JobStatus,
} from "../events/events";
import { QueueManager } from "../queue/queue-manager";
import { JobOrchestrator } from "../jobs/jobs";
import { spawn } from "bun";
import { Metadata } from "../meta/meta";
import { LLM } from "../llm/llm";
import { Logger } from "../logger/logger";
import { Utils } from "../utils/utils";
import { DB } from "../db/db";

const OUTPUT_DIR = Bun.env.OUTPUT_DIR;

type OrderedMediaEvent = VideoPromptEvent | TransitionPromptEvent;

function compareByIndex(
  a: { index?: number; created_at?: string; id: string },
  b: { index?: number; created_at?: string; id: string },
) {
  const aIndex = a.index ?? Number.MAX_SAFE_INTEGER;
  const bIndex = b.index ?? Number.MAX_SAFE_INTEGER;

  if (aIndex !== bIndex) return aIndex - bIndex;

  const aCreatedAt = a.created_at ?? "";
  const bCreatedAt = b.created_at ?? "";
  if (aCreatedAt !== bCreatedAt) return aCreatedAt.localeCompare(bCreatedAt);

  return a.id.localeCompare(b.id);
}

function orderedOutputEvents(events: JobEvent[]): OrderedMediaEvent[] {
  const videoEvents = events.filter(
    (e): e is VideoPromptEvent =>
      e.status === JobStatus.Complete && e.type === Event.NewVideoPrompt,
  );

  const transitionEvents = events.filter(
    (e): e is TransitionPromptEvent =>
      e.status === JobStatus.Complete && e.type === Event.NewTransitionPrompt,
  );

  videoEvents.sort(compareByIndex);
  transitionEvents.sort(compareByIndex);

  const outputEvents: OrderedMediaEvent[] = [];
  for (let i = 0; i < videoEvents.length; i++) {
    outputEvents.push(videoEvents[i]);

    if (i < transitionEvents.length) {
      outputEvents.push(transitionEvents[i]);
    }
  }

  return outputEvents;
}

function resolutionForJob(job: { resolution?: string }) {
  switch (job.resolution) {
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

async function runProcess(cmd: string[], context: string) {
  const process = spawn({
    cmd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const decoder = new TextDecoder();
  let stderr = "";

  for await (const chunk of process.stderr) {
    stderr += typeof chunk === "string" ? chunk : decoder.decode(chunk);
  }

  const status = await process.exited;
  if (status !== 0) {
    throw new Error(
      `${context} failed with exit code ${status}: ${stderr.trim()}`,
    );
  }
}

export namespace VideoGenerator {
  async function create_video_composition_event(jobId: string, path: string) {
    const videoCompEvent: VideoCompostionEvent = {
      id: Metadata.randomId(),
      jobId,
      mode: JobMode.Video,
      status: JobStatus.Complete,
      type: Event.NewVideoComposition,
      prompt: "n/a",
    };

    // TODO use transaction instead
    await DB.Events.create(videoCompEvent);
    await DB.Meta.create({
      event_id: videoCompEvent.id,
      filename: path,
      subfolder: "",
      type: "output",
    });
  }

  export async function schedule_video(event: {
    jobId: string;
    prompt: string;
    filename: string;
    index?: number;
  }) {
    const task = await JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewVideoPrompt,
      mode: JobMode.Video,
    });

    await QueueManager.pump();
    return task;
  }

  export async function schedule_text_to_video(event: {
    jobId: string;
    prompt: string;
    index?: number;
  }) {
    const task = await JobOrchestrator.schedule_task({
      jobId: event.jobId,
      prompt: event.prompt,
      filename: null as any,
      index: event.index,
      type: Event.NewVideoPrompt,
      mode: JobMode.Video,
    });

    await QueueManager.pump();
    return task;
  }

  export async function schedule_transition(event: {
    jobId: string;
    prompt: string;
    startImg: string;
    endImg: string;
    index?: number;
  }) {
    const task = await JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewTransitionPrompt,
      mode: JobMode.Video,
    });

    await QueueManager.pump();
    return task;
  }

  export async function generate_video(
    item: VideoPromptEvent | TransitionPromptEvent,
  ) {
    const job = await DB.Jobs.findById(item.jobId);

    Utils.assert(
      item.type === Event.NewVideoPrompt ||
        item.type === Event.NewTransitionPrompt,
      "Incorrect event type!",
    );

    const { id, prompt } = item;

    if (item.type === Event.NewTransitionPrompt) {
      const modelVariant: ModelVariant = {
        id,
        kind: "image-to-transition",
        prompt,
        startImage: item.startImg,
        endImage: item.endImg,
      };

      await comfyClient.generate(modelVariant, job);
    }

    if (item.type === Event.NewVideoPrompt) {
      if (item.filename) {
        const modelVariant: ModelVariant = {
          id,
          kind: "image-to-video",
          prompt,
          imagePath: item.filename,
        };
        await comfyClient.generate(modelVariant, job);
      } else {
        const modelVariant: ModelVariant = {
          id,
          kind: "text-to-video",
          prompt,
        };
        await comfyClient.generate(modelVariant, job);
      }
    }
  }

  export async function prepare_transitions(event: JobEvent) {
    const events = await DB.Events.findByJobId(event.jobId);
    const incompleteClips = events.filter(
      (e) =>
        e.type === Event.NewVideoPrompt &&
        (e.status === JobStatus.Pending || e.status === JobStatus.Running),
    );
    if (incompleteClips.length !== 0) return null;

    const existingTransitions = events.filter(
      (e) => e.type === Event.NewTransitionPrompt,
    );
    if (existingTransitions.length > 0) return null;

    const completedClips = events.filter(
      (e) => e.type === Event.NewVideoPrompt && e.status === JobStatus.Complete,
    ) as VideoPromptEvent[];

    // Sort by index to ensure correct order regardless of generation completion time
    completedClips.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    const frames: { first: string; last: string }[] = [];
    const prompts: string[] = [];

    for (const clip of completedClips) {
      const tmpFile = `/tmp/${event.jobId}_${clip.id}.mp4`;
      const [first, last] = await video_frames(clip.id, tmpFile);

      frames.push({
        first,
        last,
      });

      prompts.push(clip.prompt);
    }

    const transitions: {
      first: string;
      last: string;
      prompt: string;
      index: number;
    }[] = [];

    for (let i = 0; i < frames.length; i++) {
      const current = frames[i];
      const next = frames[i + 1];

      if (i === frames.length - 1) continue;
      const prompt = await transition_prompt(
        completedClips[i].prompt,
        completedClips[i + 1].prompt,
      );

      // TODO add retry if prompt is null
      if (prompt === null) {
        Logger.warn("Failed to get transition prompt - skipping");
        continue;
      }

      transitions.push({
        first: current.last,
        last: next.first,
        prompt,
        index: i,
      });

      Logger.info(
        `Preparing transition ${i} between clip ${completedClips[i].id} and ${completedClips[i + 1].id}`,
      );
    }

    return transitions;
  }

  async function video_frames(id: string, filePath: string) {
    const { INPUT_DIR } = Bun.env;
    const names = [`${id}_first_frame.png`, `${id}_last_frame.png`];
    const paths = [`${INPUT_DIR}/${names[0]}`, `${INPUT_DIR}/${names[1]}`];

    const processes = [
      {
        args: [
          "ffmpeg",
          "-y",
          "-nostdin",
          "-i",
          filePath,
          "-frames:v",
          "1",
          "-update",
          "1",
          paths[0],
        ],
      },
      {
        args: [
          "ffmpeg",
          "-y",
          "-nostdin",
          "-sseof",
          "-2",
          "-i",
          filePath,
          "-update",
          "1",
          paths[1],
        ],
      },
    ];

    for (const process of processes) {
      const ffmpegProcess = spawn({
        cmd: process.args,
        stdio: ["ignore", "ignore", "ignore"],
      });

      await ffmpegProcess.exited;

      if (ffmpegProcess.exitCode !== 0) {
        throw new Error("Failed to execute 'ffmpgeg'");
      }
    }

    return names;
  }

  export async function video_frames_for_asset(
    jobId: string,
    id: string,
    filePath: string,
  ) {
    const names = await video_frames(id, filePath);
    return names.map((name) => `${Bun.env.INPUT_DIR}/${name}`) as [
      string,
      string,
    ];
  }

  async function transition_prompt(first: string, second: string) {
    const instructions = `Here are two different prompts for generating videos based on images.

First prompt:

${first}

Second prompt:

${second}

These two have been used already to generate two separate videos.
Your task is to merge both of these prompts into a single prompt in order to create
a ${Metadata.TRANSITION_DURATION} second long video transition.

The last frame from the first video and the first frame from the second video will
be used in order to generate a transition based on this new merged prompt meaning.

The transition should not be just a simple cut, but consider the visual context because
the transition will be generated using artificial intelligence so it can be a smart
video transition.

For example when there is an object in the first video and also the same object in the
second video then the transition could be described so that the object is being transported
to the new place in a creative way which considers the context of the first and second video.

Generate a creative and meaningful prompt for a video transition!

Your response should only include the newly generated prompt!
`;

    const res = await LLM.message(instructions);
    return res?.content ?? null;
  }

  export async function combine_outputs(jobId: string): Promise<void> {
    Logger.info(`Starting video combination for job ${jobId}`);

    const job = await DB.Jobs.findById(jobId);
    const events = await DB.Events.findByJobId(jobId);
    Logger.info(`Found ${events.length} total events for job ${jobId}`);

    const outputEvents = orderedOutputEvents(events);

    Logger.info(
      `Ordered media events for concat:`,
      outputEvents.map((e) => ({
        type: e.type,
        index: e.index,
      })),
    );

    if (outputEvents.length === 0) {
      Logger.warn(`No complete media events found for job ${jobId}`);
      return;
    }

    if (outputEvents.length <= 1) {
      Logger.info(`Single clip video, skipping composition for job ${jobId}`);
      return;
    }

    const fps = job.fps || Metadata.FPS;
    const { width, height } = resolutionForJob(job);

    Logger.info(
      `Final combined event order:`,
      outputEvents.map((e) => ({
        type: e.type,
        index: e.index,
      })),
    );

    const files: string[] = [];
    for (let i = 0; i < outputEvents.length; i++) {
      const e = outputEvents[i];
      const sourceFile = `/tmp/${jobId}_${e.id}.mp4`;
      const normalizedFile = `/tmp/${jobId}_${String(i).padStart(3, "0")}_normalized.mp4`;

      Logger.info(
        `Normalizing file for concat: ${sourceFile} -> ${normalizedFile} (index: ${e.index})`,
      );

      await runProcess(
        [
          "ffmpeg",
          "-y",
          "-i",
          sourceFile,
          "-vf",
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps},format=yuv420p`,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "18",
          "-c:a",
          "aac",
          "-ar",
          "48000",
          "-ac",
          "2",
          "-movflags",
          "+faststart",
          normalizedFile,
        ],
        `Segment normalization for ${sourceFile}`,
      );

      Logger.info(
        `Adding file to combine: ${normalizedFile} (index: ${e.index})`,
      );

      files.push(normalizedFile);
    }

    const fileList = files.map((f) => `file '${f}'`).join("\n") + "\n";
    const listFile = `/tmp/${jobId}_concat.txt`;
    await Bun.write(listFile, fileList);

    try {
      const name = `composition_${jobId}.mp4`;
      const out = `${OUTPUT_DIR}/${name}`;
      Logger.info(`Executing ffmpeg to create ${out}`);

      const ffmpegProcess = spawn({
        cmd: [
          "ffmpeg",
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listFile,
          "-c",
          "copy",
          `${out}`,
        ],
        stdio: ["ignore", "pipe", "pipe"],
      });

      for await (const chunk of ffmpegProcess.stderr!) {
        if (typeof chunk === "string") {
          Logger.info("ffmpeg:", chunk);
        } else {
          Logger.info("ffmpeg:", new TextDecoder().decode(chunk));
        }
      }

      const status = await ffmpegProcess.exited;
      if (status !== 0) {
        throw new Error(`FFmpeg failed with exit code ${status}`);
      }

      await create_video_composition_event(jobId, name);
      Logger.info(`Video combination completed successfully!`);
    } catch (error: any) {
      Logger.error("Video combination failed:", error.message);
    } finally {
      // await Bun.file(listFile).delete();
    }
  }
}
