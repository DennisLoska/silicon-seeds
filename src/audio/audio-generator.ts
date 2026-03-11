import { comfyClient } from "../comfyui/comfyui-client";
import { AudioPromptEvent, Event, JobMode } from "../events/events";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";

export namespace AudioGenerator {
  export function init() {
    Event.on(Event.NewAudioPrompt, (event) => {
      QueueManager.audioQueue.push(event);
      generate_audio();
    });
  }

  export function schedule_audio({
    id,
    prompt,
    duration,
  }: {
    id: string;
    prompt?: string;
    duration?: number;
  }) {
    const event: AudioPromptEvent = {
      type: Event.NewAudioPrompt,
      id,
      jobId: id,
      mode: prompt ? JobMode.Speech : JobMode.Instrumental,
      prompt,
      duration,
    };

    Event.emit(Event.NewAudioPrompt, event);
  }

  export function generate_audio() {
    if (QueueManager.isAudioQueueBlocked()) return;

    const item = QueueManager.pop("audio");
    assert(item.type === Event.NewAudioPrompt, "Incorrect event type!");

    const { prompt, id, mode, duration } = item;

    if (mode === JobMode.Speech) {
      assert(typeof prompt === "string", "'prompt' is not a string");
      void comfyClient.generate({
        id,
        kind: "text-to-speech",
        prompt,
      });
    }

    if (mode === JobMode.Instrumental) {
      assert(duration && duration > 0, "'duration' is not a number");
      void comfyClient.generate({
        id,
        kind: "text-to-instrumental",
        prompt,
        duration,
      });
    }
  }

  export async function get_audio(id: string) {
    return await new Promise((res, rej) => {
      Event.on(Event.ComfyExecuted, (event) => {
        if (event.id === id) res(event);
      });
      setTimeout(() => {
        rej();
      }, 30_000);
    });
  }
}
