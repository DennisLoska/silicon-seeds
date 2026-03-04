import { Event } from "../events/events";
import { comfyClient } from "../comfyui/comfyui-client";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";

export namespace ImageGenerator {
  export function init() {
    Event.on(Event.NewTextPrompt, (event) => {
      QueueManager.imageQueue.push(event);
      generate_image();
    });
  }

  export function generate_image() {
    if (QueueManager.isBlocked()) {
      return;
    }

    const item = QueueManager.imageQueue.shift();
    assert(item && item.type === Event.NewTextPrompt, "Incorrect event type!");
    QueueManager.completed.push(item);

    const { prompt, id } = item;
    void comfyClient.generate({ id, kind: "text-to-image", prompt });
  }
}
