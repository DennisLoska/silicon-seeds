import { comfyClient } from "../comfyui/comfyui-client";
import {
  AudioPromptEvent,
  ComfyExecutedEvent,
  Event,
  JobMode,
} from "../events/events";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";
import { Metadata } from "../meta/meta";

export namespace AudioGenerator {
  export function init() {
    Event.on(Event.NewAudioPrompt, (event) => {
      QueueManager.audioQueue.push(event);
      generate_audio();
    });
  }

  export function schedule_audio({
    id,
    jobId,
    prompt,
    duration,
  }: {
    id: string;
    jobId: string;
    prompt?: string;
    duration?: number;
  }) {
    const event: AudioPromptEvent = {
      type: Event.NewAudioPrompt,
      id,
      jobId: jobId,
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

  export async function get_audio(id: string): Promise<ComfyExecutedEvent> {
    return await new Promise((res, rej) => {
      Event.on(Event.ComfyExecuted, (event) => {
        if (event.id === id) res(event);
      });
      setTimeout(() => {
        rej("Event timeout exceeded");
      }, Metadata.TIMEOUT);
    });
  }
}
