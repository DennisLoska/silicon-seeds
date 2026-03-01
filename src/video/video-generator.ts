import { comfyClient } from "../comfyui";
import { Event, Events } from "../events/events";
import assert from "node:assert";

export namespace VideoGenerator {
  const queue: Events = [];

  export function init() {
    process_events();
    generate_video();
  }

  function process_events() {
    Event.on(Event.NewVideoPrompt, (event) => {
      queue.push(event);
    });
  }

  function generate_video() {
    Event.on(Event.NewVideo, async () => {
      if (queue.length <= 0) return;

      const item = queue.shift();
      assert(
        item && item.type === Event.NewVideoPrompt,
        "Incorrect event type!",
      );

      const { prompt } = item;

      await comfyClient.generate({
        kind: "image-to-video",
        prompt,
        imagePath: item.filename,
      });
    });
  }
}
