import { comfyClient, ModelVariant } from "../comfyui/comfyui-client";
import { AudioPromptEvent, Event, JobMode } from "../events/events";
import { QueueManager } from "../queue/queue-manager";
import { JobOrchestrator } from "../jobs/jobs";
import { Utils } from "../utils/utils";
import { DB } from "../db/db";

export namespace AudioGenerator {
  export function init() {
    Event.on(Event.NewAudioPrompt, (event) => {
      void QueueManager.pump();
    });
  }

  export async function schedule_audio(event: {
    id?: string;
    jobId: string;
    prompt?: string;
    duration?: number;
  }) {
    return await JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewAudioPrompt,
      mode: event.prompt ? JobMode.Speech : JobMode.Instrumental,
    });
  }

  export async function generate_audio(item: AudioPromptEvent) {
    const job = await DB.Jobs.findById(item.jobId);
    Utils.assert(item.type === Event.NewAudioPrompt, "Incorrect event type!");

    const { prompt, id, mode, duration } = item;

    if (mode === JobMode.Speech) {
      Utils.assert(typeof prompt === "string", "'prompt' is not a string");
      const modelVariant: ModelVariant = {
        id,
        kind: "text-to-speech",
        prompt,
      };

      await comfyClient.generate(modelVariant, job);
    }

    if (mode === JobMode.Instrumental) {
      Utils.assert(duration && duration > 0, "'duration' is not a number");
      const modelVariant: ModelVariant = {
        id,
        kind: "text-to-instrumental",
        prompt: prompt ?? null,
        duration,
      };

      await comfyClient.generate(modelVariant, job);
    }
  }
}
