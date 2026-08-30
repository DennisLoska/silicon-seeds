import { Event, ImagePromptEvent, JobMode } from "../events/events";
import { comfyClient, ModelVariant } from "../comfyui/comfyui-client";
import { QueueManager } from "../queue/queue-manager";
import { JobOrchestrator } from "../jobs/jobs";
import { Utils } from "../utils/utils";
import { Lora } from "../styles/presets";
import { DB } from "../db/db";

export namespace ImageGenerator {
  export async function schedule_image(event: {
    id?: string;
    jobId: string;
    mode: JobMode;
    prompt: string;
    lora?: Lora;
    loras?: { name: string; strength: number }[];
    index?: number;
  }) {
    const task = await JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewImagePrompt,
    } as any);

    await QueueManager.pump();
    return task;
  }

  export async function generate_image(item: ImagePromptEvent) {
    const job = await DB.Jobs.findById(item.jobId);
    Utils.assert(item.type === Event.NewImagePrompt, "Incorrect event type!");

    const { prompt, id, lora, loras } = item as any;
    const modelVariant: ModelVariant = {
      id,
      kind: "text-to-image",
      prompt,
      lora,
      loras: loras as any,
    } as any;
    await comfyClient.generate(modelVariant, job);
  }
}
