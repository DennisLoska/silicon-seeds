import {
  AudioPromptEvent,
  ImagePromptEvent,
  JobEvents,
  TransitionPromptEvent,
  VideoPromptEvent,
} from "../events/events";
import assert from "node:assert";
import { JobOrchestrator } from "../jobs/jobs";

export namespace QueueManager {
  export let comfyQueue = 0;

  // TODO replace with actual db
  export const completed: JobEvents = [];

  // For now in memory queue only
  export const imageQueue: ImagePromptEvent[] = [];
  export const videoQueue: (VideoPromptEvent | TransitionPromptEvent)[] = [];
  export const audioQueue: AudioPromptEvent[] = [];

  export function pop(type: "image" | "video" | "audio") {
    let item:
      | ImagePromptEvent
      | VideoPromptEvent
      | TransitionPromptEvent
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
    // status is pending
    JobOrchestrator.update_job({
      ...item,
      status: "pending",
    });

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
