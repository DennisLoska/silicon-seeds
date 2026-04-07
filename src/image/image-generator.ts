import { ComfyExecutedEvent, Event, JobMode } from "../events/events";
import { comfyClient, ModelVariant } from "../comfyui/comfyui-client";
import { QueueManager } from "../queue/queue-manager";
import { Metadata } from "../meta/meta";
import { JobOrchestrator } from "../jobs/jobs";
import { Utils } from "../utils/utils";
import { Lora } from "../styles/presets";
import { DB } from "../db/db";

export namespace ImageGenerator {
  export function init() {
    Event.on(Event.NewImagePrompt, (event) => {
      QueueManager.imageQueue.push(event);
      generate_image();
    });
  }

  export function schedule_image(event: {
    jobId: string;
    mode: JobMode;
    prompt: string;
    lora?: Lora;
    index?: number;
  }) {
    JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewImagePrompt,
    });
  }

  export async function generate_image() {
    if (QueueManager.isImageQueueBlocked()) return;

    const item = QueueManager.pop("image");
    const job = await DB.Jobs.findById(item.jobId);
    Utils.assert(item.type === Event.NewImagePrompt, "Incorrect event type!");

    const { prompt, id, lora } = item;
    const modelVariant: ModelVariant = {
      id,
      kind: "text-to-image",
      prompt,
      lora,
    };
    void comfyClient.generate(modelVariant, job);
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
