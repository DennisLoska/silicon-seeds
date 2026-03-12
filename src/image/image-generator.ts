import { ComfyExecutedEvent, Event, JobMode } from "../events/events";
import { comfyClient } from "../comfyui/comfyui-client";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";
import { Metadata } from "../meta/meta";

export namespace ImageGenerator {
  export function init() {
    Event.on(Event.NewImagePrompt, (event) => {
      QueueManager.imageQueue.push(event);
      generate_image();
    });
  }

  export function schedule_image({
    id,
    jobId,
    mode,
    prompt,
  }: {
    id?: string;
    jobId: string;
    mode: JobMode;
    prompt: string;
  }) {
    Event.emit(Event.NewImagePrompt, {
      id: id ?? Bun.randomUUIDv7(),
      created_at: new Date().toISOString(),
      jobId,
      mode,
      type: Event.NewImagePrompt,
      prompt,
    });
  }

  export function generate_image() {
    if (QueueManager.isImageQueueBlocked()) return;

    const item = QueueManager.pop("image");
    assert(item.type === Event.NewImagePrompt, "Incorrect event type!");

    const { prompt, id } = item;
    void comfyClient.generate({ id, kind: "text-to-image", prompt });
  }

  export async function get_image(id: string): Promise<ComfyExecutedEvent> {
    return await new Promise((res, rej) => {
      Event.on(Event.ComfyExecuted, (event) => {
        if (event.id === id) res(event);
      });

      setTimeout(() => {
        rej("Event timeout exceeded");
      }, Metadata.TIMEOUT * 1000);
    });
  }
}
