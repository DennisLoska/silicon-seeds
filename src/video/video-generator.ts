import { comfyClient } from "../comfyui/comfyui-client";
import { Event } from "../events/events";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";

export namespace VideoGenerator {
  export function init() {
    Event.on(Event.NewVideoPrompt, (event) => {
      QueueManager.videoQueue.push(event);
      generate_video();
    });
  }

  export function generate_video() {
    if (QueueManager.isVideoQueueBlocked()) return;

    const item = QueueManager.pop("video");
    assert(item.type === Event.NewVideoPrompt, "Incorrect event type!");

    const { id, prompt } = item;

    void comfyClient.generate({
      id,
      kind: "image-to-video",
      prompt,
      imagePath: item.filename,
    });
  }
}
