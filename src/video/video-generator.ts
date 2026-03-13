import { comfyClient } from "../comfyui/comfyui-client";
import { Event, JobEvent, JobMode, VideoPromptEvent } from "../events/events";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";
import { JobOrchestrator } from "../jobs/jobs";
import { spawn } from "bun";
import { Metadata } from "../meta/meta";
import { LLM } from "../llm/llm";

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
    assert(
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

    // TODO might want to actively sort by chronological order
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

      transitions.push({
        first: current.last,
        last: next.first,
        prompt,
      });
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

    try {
      const res = await LLM.message(instructions);
      return res.content;
    } catch (error) {
      return "everybody shut the fuck up";
    }
  }
}
