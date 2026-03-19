import { comfyClient } from "../comfyui/comfyui-client";
import {
  Event,
  JobEvent,
  JobMode,
  VideoPromptEvent,
  TransitionPromptEvent,
} from "../events/events";
import { QueueManager } from "../queue/queue-manager";
import { JobOrchestrator } from "../jobs/jobs";
import { spawn } from "bun";
import { Metadata } from "../meta/meta";
import { LLM } from "../llm/llm";
import { Logger } from "../logger/logger";
import { Utils } from "../utils/utils";

const OUTPUT_DIR = Bun.env.OUTPUT_DIR;

export namespace VideoGenerator {
  export function init() {
    Event.on(Event.NewVideoPrompt, (event) => {
      QueueManager.videoQueue.push(event);
      generate_video();
    });
    Event.on(Event.NewTransitionPrompt, (event) => {
      QueueManager.videoQueue.push(event);
      generate_video();
    });
  }

  export function schedule_video(event: {
    jobId: string;
    prompt: string;
    filename: string;
    index?: number;
  }) {
    JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewVideoPrompt,
      mode: JobMode.Video,
    });
  }

  export function schedule_transition(event: {
    jobId: string;
    prompt: string;
    startImg: string;
    endImg: string;
    index?: number;
  }) {
    JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewTransitionPrompt,
      mode: JobMode.Video,
    });
  }

  export function generate_video() {
    // TODO fix potential race condition
    if (QueueManager.isVideoQueueBlocked()) return;

    const item = QueueManager.pop("video");
    Utils.assert(
      item.type === Event.NewVideoPrompt ||
        item.type === Event.NewTransitionPrompt,
      "Incorrect event type!",
    );

    const { id, prompt } = item;

    if (item.type === Event.NewTransitionPrompt) {
      void comfyClient.generate({
        id,
        kind: "image-to-transition",
        prompt,
        startImage: item.startImg,
        endImage: item.endImg,
      });
    }

    if (item.type === Event.NewVideoPrompt) {
      void comfyClient.generate({
        id,
        kind: "image-to-video",
        prompt,
        imagePath: item.filename,
      });
    }
  }

  export async function prepare_transitions(event: JobEvent) {
    const completed = QueueManager.findEventById(event.id);
    if (!completed?.jobId) return null;

    const job = JobOrchestrator.jobs[completed?.jobId];

    const pendingClips = JobOrchestrator.job_events(job.id).filter(
      (e) => e.type === Event.NewVideoPrompt && e.status === "pending",
    );
    if (pendingClips.length !== 0) return null;

    const completedClips = JobOrchestrator.job_events(job.id).filter(
      (e) => e.type === Event.NewVideoPrompt && e.status === "complete",
    ) as VideoPromptEvent[];

    // Sort by index to ensure correct order regardless of generation completion time
    completedClips.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    const frames: { first: string; last: string }[] = [];
    const prompts: string[] = [];

    for (const clip of completedClips) {
      const meta = job.meta[clip.id] as any;
      const metadata = meta.images[0];

      const videoBlob = await comfyClient.getAsset(
        metadata.filename,
        metadata.subfolder,
        metadata.type,
      );

      const tmpFile = `/tmp/${event.jobId}_${clip.id}.mp4`;
      await Bun.write(tmpFile, await videoBlob.arrayBuffer());
      const [first, last] = await video_frames(clip.id, tmpFile);

      frames.push({
        first,
        last,
      });

      prompts.push(clip.prompt);
    }

    const transitions: { first: string; last: string; prompt: string }[] = [];
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
      let ffmpegProcess = spawn({
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

    const events = JobOrchestrator.job_events(jobId);
    Logger.info(`Found ${events.length} total events for job ${jobId}`);

    // Separate videos and transitions
    const videoEvents = events.filter(
      (e) => e.status === "complete" && e.type === Event.NewVideoPrompt,
    );

    const transitionEvents = events.filter(
      (e) => e.status === "complete" && e.type === Event.NewTransitionPrompt,
    );

    Logger.info(`Found ${videoEvents.length} video events`);
    Logger.info(`Found ${transitionEvents.length} transition events`);

    // Sort videos by their explicit index
    videoEvents.sort((a, b) => {
      const aIndex = (a as VideoPromptEvent).index ?? Number.MAX_SAFE_INTEGER;
      const bIndex = (b as VideoPromptEvent).index ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });

    Logger.info(
      `Sorted video events by index:`,
      videoEvents.map((e) => ({
        type: e.type,
        index: (e as VideoPromptEvent).index,
      })),
    );

    // Combine videos and transitions in order
    const outputEvents = [];
    for (let i = 0; i < videoEvents.length; i++) {
      if (i < videoEvents.length) outputEvents.push(videoEvents[i]);
      if (i < transitionEvents.length) outputEvents.push(transitionEvents[i]);
    }

    Logger.info(
      `Final combined event order:`,
      outputEvents.map((e) => ({
        type: e.type,
        index: (e as VideoPromptEvent | TransitionPromptEvent).index,
      })),
    );

    const files: string[] = [];
    for (const e of outputEvents) {
      const meta = JobOrchestrator.jobs[jobId].meta[e.id] as any;
      Utils.assert(meta && meta.images, `Missing metadata for event ${e.id}`);

      const filename = meta.images[0]?.filename;
      Utils.assert(filename, `No filename found in metadata for event ${e.id}`);

      Logger.info(
        `Adding file to combine: ${filename} (index: ${(e as any).index})`,
      );

      files.push(filename);
    }

    const fileList = files.map((f) => `file '${f}'`).join("\n");
    const listFile = `/tmp/${jobId}_concat.txt`;
    await Bun.write(listFile, fileList);

    try {
      const outputExt = Bun.env.COMBINED_OUTPUT_FORMAT || "mp4";
      Logger.info(
        `Executing ffmpeg to create ${OUTPUT_DIR}/output-combined.${outputExt}`,
      );

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
          `${OUTPUT_DIR}/output-combined.${outputExt}`,
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

      Logger.info(`Video combination completed successfully!`);
    } catch (error: any) {
      Logger.error("Video combination failed:", error.message);
    } finally {
      await Bun.file(listFile).delete();
    }
  }
}
