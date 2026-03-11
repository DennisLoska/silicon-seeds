import {
  AudioPromptEvent,
  ImagePromptEvent,
  JobEvents,
  VideoPromptEvent,
} from "../events/events";
import assert from "node:assert";
import { JobOrchestrator } from "../jobs/jobs";

export namespace QueueManager {
  export let comfyQueue = 0;

  export const completed: JobEvents = [];
  export const imageQueue: ImagePromptEvent[] = [];
  export const videoQueue: VideoPromptEvent[] = [];
  export const audioQueue: AudioPromptEvent[] = [];

  export function pop(type: "image" | "video" | "audio") {
    let item:
      | ImagePromptEvent
      | VideoPromptEvent
      | AudioPromptEvent
      | undefined;

    if (type === "image") {
      item = imageQueue.shift();
    }

    if (type === "audio") {
      item = audioQueue.shift();
    }

    if (type === "video") {
      item = videoQueue.shift();
    }

    assert(item, "Attempted to take item from empty or invalid queue");
    completed.push(item);
    JobOrchestrator.update_job(item);
    return item;
  }

  export function findEventById(id: string) {
    return completed.find((e) => e.id === id) ?? null;
  }

  export function isImageQueueBlocked() {
    return imageQueue.length <= 0 || comfyQueue > 0;
  }

  export function isAudioQueueBlocked() {
    return audioQueue.length <= 0 || comfyQueue > 3;
  }

  export function isVideoQueueBlocked() {
    return videoQueue.length <= 0 || imageQueue.length > 0 || comfyQueue > 0;
  }
}
