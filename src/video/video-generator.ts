import { comfyClient } from "../comfyui/comfyui-client";
import { Event, JobMode } from "../events/events";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";

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

  export function schedule_video({
    jobId,
    prompt,
    filename,
  }: {
    jobId: string;
    prompt: string;
    filename: string;
  }) {
    Event.emit(Event.NewVideoPrompt, {
      id: Bun.randomUUIDv7(),
      created_at: new Date().toISOString(),
      jobId,
      mode: JobMode.Video,
      type: Event.NewVideoPrompt,
      prompt,
      filename,
    });
  }

  export function schedule_transition({
    jobId,
    prompt,
    startImg,
    endImg,
  }: {
    jobId: string;
    prompt: string;
    startImg: string;
    endImg: string;
  }) {
    Event.emit(Event.NewTransitionPrompt, {
      id: Bun.randomUUIDv7(),
      created_at: new Date().toISOString(),
      jobId,
      mode: JobMode.Video,
      type: Event.NewTransitionPrompt,
      prompt,
      startImg,
      endImg,
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
}
