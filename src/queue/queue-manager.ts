import { Events, TextPromptEvent } from "../events/events";

export namespace QueueManager {
  export let comfyQueueCounter = 0;

  export const completed: Events = [];
  export const imageQueue: TextPromptEvent[] = [];

  export function findEventById(id: string) {
    return completed.find((e) => e.id === id) ?? null;
  }

  export function isBlocked() {
    return imageQueue.length <= 0 || comfyQueueCounter > 0;
  }
}
