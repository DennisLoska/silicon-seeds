import { comfyClient } from "../comfyui/comfyui-client";
import { Event, JobEvent, JobMode, VideoPromptEvent } from "../events/events";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";
import { JobOrchestrator } from "../jobs/jobs";
import { spawn } from "bun";
import { PromptGenerator } from "../prompts/prompt-generator";

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
    console.log("job", job);

    const pendingClips = JobOrchestrator.job_events(job.id).filter(
      (e) => e.type === Event.NewVideoPrompt && e.status === "pending",
    );
    // TODO fix diese scheisse
    if (pendingClips.length !== 0) return null;
    console.log("pending", pendingClips.length);

    const completedClips = JobOrchestrator.job_events(job.id).filter(
      (e) => e.type === Event.NewVideoPrompt && e.status === "complete",
    ) as VideoPromptEvent[];
    console.log("complete", completedClips);

    // TODO sort by chronological order
    console.log("CLIPS", completedClips.length);
    const frames: { first: string; last: string }[] = [];
    const prompts: string[] = [];

    for (const clip of completedClips) {
      const meta = job.meta[clip.id] as any;
      const metadata = meta.images[0];
      console.log("META", JSON.stringify(meta));

      const videoBlob = await comfyClient.getAsset(
        metadata.filename,
        metadata.subfolder,
        metadata.type,
      );

      const tmpFile = `/tmp/${event.jobId}_${clip.id}.mp4`;
      await Bun.write(tmpFile, await videoBlob.arrayBuffer());
      const [firstFramePath, lastFramePath] = await video_frames(
        clip.id,
        tmpFile,
      );

      frames.push({
        first: firstFramePath,
        last: lastFramePath,
      });

      prompts.push(clip.prompt);
    }

    const transitions: { first: string; last: string; prompt: string }[] = [];
    frames.forEach((pair, i) => {
      if (i === transitions.length - 1) return;
      transitions.push({
        first: pair.last,
        last: transitions[i + 1].first,
        prompt: PromptGenerator.transition_prompt(
          completedClips[i].prompt,
          completedClips[i + 1].prompt,
        ),
      });
    });

    return transitions;
  }

  async function video_frames(id: string, filePath: string) {
    const { INPUT_DIR } = Bun.env;
    const paths = [
      `${INPUT_DIR}/${id}_first_frame.png`,
      `${INPUT_DIR}/${id}_last_frame.png`,
    ];

    const processes = [
      {
        args: ["ffmpeg", "-i", filePath, "-frames:v 1", paths[0]],
      },
      {
        args: [
          "ffmpeg",
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
      let ffmpegProcess = spawn(process.args);
      const decoder = new TextDecoder();

      let output = "";
      for await (const chunk of ffmpegProcess.stdout) {
        output += decoder.decode(chunk, { stream: true });
      }

      const status = await ffmpegProcess.exited;

      if (status !== 0) {
        throw new Error("Failed to execute 'ffmpgeg'");
      }
    }

    return paths;
  }
}
