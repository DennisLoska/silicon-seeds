import { comfyClient } from "../comfyui/comfyui-client";
import { ComfyExecutedEvent, Event, JobMode } from "../events/events";
import { QueueManager } from "../queue/queue-manager";
import { Metadata } from "../meta/meta";
import { JobOrchestrator } from "../jobs/jobs";
import { Utils } from "../utils/utils";

export namespace AudioGenerator {
  export function init() {
    Event.on(Event.NewAudioPrompt, (event) => {
      QueueManager.audioQueue.push(event);
      generate_audio();
    });
  }

  export function schedule_audio(event: {
    id?: string;
    jobId: string;
    prompt?: string;
    duration?: number;
  }) {
    JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewAudioPrompt,
      mode: event.prompt ? JobMode.Speech : JobMode.Instrumental,
    });
  }

  export function generate_audio() {
    if (QueueManager.isAudioQueueBlocked()) return;

    const item = QueueManager.pop("audio");
    Utils.assert(item.type === Event.NewAudioPrompt, "Incorrect event type!");

    const { prompt, id, mode, duration } = item;

    if (mode === JobMode.Speech) {
      Utils.assert(typeof prompt === "string", "'prompt' is not a string");
      void comfyClient.generate({
        id,
        kind: "text-to-speech",
        prompt,
      });
    }

    if (mode === JobMode.Instrumental) {
      Utils.assert(duration && duration > 0, "'duration' is not a number");
      void comfyClient.generate({
        id,
        kind: "text-to-instrumental",
        prompt: prompt ?? null,
        duration,
      });
    }
  }

  export async function get_audio(id: string): Promise<ComfyExecutedEvent> {
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
