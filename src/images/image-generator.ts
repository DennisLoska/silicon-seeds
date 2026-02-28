import { Event, Events } from "../events/events";
import { comfyClient } from "../lib/comfyui";
import assert from "node:assert";

export namespace ImageGenerator {
  const queue: Events = [];

  export function init() {
    process_events();
    generate_image();
  }

  function process_events() {
    Event.on(Event.NewTextPrompt, (event) => {
      assert(event.type === Event.NewTextPrompt, "Incorrect event type!");
      queue.push(event);
    });
  }

  export function generate_image() {
    Event.on(Event.NewImage, async () => {
      if (queue.length <= 0) return;

      const item = queue.shift();
      assert(
        item && item.type === Event.NewTextPrompt,
        "Incorrect event type!",
      );

      const { prompt } = item;
      await comfyClient.generate({ kind: "text-to-image", prompt });
    });
  }
}
