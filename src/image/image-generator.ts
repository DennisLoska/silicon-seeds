import { Event, TextPromptEvent } from "../events/events";
import { comfyClient } from "../comfyui/comfyui-client";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";

export namespace ImageGenerator {
  const queue: TextPromptEvent[] = [];

  export function init() {
    Event.on(Event.NewTextPrompt, (event) => {
      queue.push(event);
      generate_image();
    });
  }

  export function generate_image() {
    if (queue.length <= 0 || QueueManager.comfyQueueCounter > 0) {
      console.log("Queue conditions not met - skipping image generation");
      return;
    }

    const item = queue.shift();
    assert(item && item.type === Event.NewTextPrompt, "Incorrect event type!");

    const { prompt, id } = item;
    void comfyClient.generate({ id, kind: "text-to-image", prompt });
  }
}
