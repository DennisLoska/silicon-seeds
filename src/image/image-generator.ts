import { Event, ImagePromptEvent, JobMode } from "../events/events";
import { comfyClient, ModelVariant } from "../comfyui/comfyui-client";
import { QueueManager } from "../queue/queue-manager";
import { JobOrchestrator } from "../jobs/jobs";
import { Utils } from "../utils/utils";
import { Lora } from "../styles/presets";
import { DB } from "../db/db";

export namespace ImageGenerator {
  export function init() {
    Event.on(Event.NewImagePrompt, (event) => {
      void QueueManager.pump();
    });
  }

  export async function schedule_image(event: {
    id?: string;
    jobId: string;
    mode: JobMode;
    prompt: string;
    lora?: Lora;
    index?: number;
  }) {
    return await JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewImagePrompt,
    });
  }

  export async function generate_image(item: ImagePromptEvent) {
    const job = await DB.Jobs.findById(item.jobId);
    Utils.assert(item.type === Event.NewImagePrompt, "Incorrect event type!");

    const { prompt, id, lora } = item;
    const modelVariant: ModelVariant = {
      id,
      kind: "text-to-image",
      prompt,
      lora,
    };
    await comfyClient.generate(modelVariant, job);
  }
}
