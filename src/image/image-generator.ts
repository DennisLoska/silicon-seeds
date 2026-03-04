import { Event } from "../events/events";
import { comfyClient } from "../comfyui/comfyui-client";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";

export namespace ImageGenerator {
  export function init() {
    Event.on(Event.NewImagePrompt, (event) => {
      QueueManager.imageQueue.push(event);
      generate_image();
    });
  }

  export function generate_image() {
    if (QueueManager.isImageQueueBlocked()) return;

    const item = QueueManager.pop("image");
    assert(item.type === Event.NewImagePrompt, "Incorrect event type!");

    const { prompt, id } = item;
    void comfyClient.generate({ id, kind: "text-to-image", prompt });
  }
}
