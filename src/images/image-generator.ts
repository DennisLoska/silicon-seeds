import { Event, Events } from "../events/events";
import { comfyClient } from "../lib/comfyui";

export namespace ImageGenerator {
  const queue: Events = [];

  export function init() {
    process_events();
    generate_image();
  }

  function process_events() {
    Event.on(Event.NewImagePrompt, (event) => {
      if (event?.prompt) queue.push(event);
    });
  }

  export function generate_image() {
    Event.on(Event.NewImage, async () => {
      if (queue.length <= 0) return;

      const event = queue.shift();
      if (!event) return;

      const { prompt } = event;
      await comfyClient.generate({ kind: "text-to-image", prompt });
    });
  }
}
