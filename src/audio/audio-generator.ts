import { comfyClient } from "../comfyui/comfyui-client";
import { AudioPromptEvent, Event, JobMode } from "../events/events";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";

export namespace AudioGenerator {
  export function init() {
    Event.on(Event.NewAudioPrompt, (event) => {
      QueueManager.audioQueue.push(event);
      generate_tts();
    });
  }

  export function schedule_audio(id: string, prompt: string) {
    const event: AudioPromptEvent = {
      type: Event.NewAudioPrompt,
      id,
      jobId: id,
      mode: JobMode.Audio,
      prompt,
    };

    Event.emit(Event.NewAudioPrompt, event);
  }

  export function generate_tts() {
    if (QueueManager.isAudioQueueBlocked()) return;

    const item = QueueManager.pop("audio");
    assert(item.type === Event.NewAudioPrompt, "Incorrect event type!");

    const { prompt, id } = item;

    void comfyClient.generate({
      id,
      kind: "text-to-speech",
      prompt,
    });
  }

  export async function get_audio(id: string) {
    return await new Promise((res, rej) => {
      Event.on(Event.ComfyExecuted, (event) => {
        if (event.id === id) res(event);
      });
      setTimeout(() => {
        rej();
      }, 15_000);
    });
  }
}
