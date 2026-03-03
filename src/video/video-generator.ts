import { comfyClient } from "../comfyui/comfyui-client";
import { Event, Events } from "../events/events";
import assert from "node:assert";

export namespace VideoGenerator {
  const queue: Events = [];

  export function init() {
    Event.on(Event.NewVideoPrompt, (event) => {
      queue.push(event);
      generate_video();
    });
  }

  async function generate_video() {
    if (queue.length <= 0) return;

    const item = queue.shift();
    assert(item && item.type === Event.NewVideoPrompt, "Incorrect event type!");

    const { id, prompt } = item;

    void comfyClient.generate({
      id,
      kind: "image-to-video",
      prompt,
      imagePath: item.filename,
    });
  }
}
