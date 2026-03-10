import { comfyClient } from "../comfyui/comfyui-client";
import { Event, JobMode } from "../events/events";
import assert from "node:assert";
import { QueueManager } from "../queue/queue-manager";

export namespace AudioGenerator {
  export async function tts(id: string, prompt: string) {
    // pseudo event for tracking
    QueueManager.completed.push({
      type: Event.NewAudioPrompt,
      id,
      jobId: id,
      mode: JobMode.Audio,
      prompt,
    });

    const res = await comfyClient.generate({
      id,
      kind: "text-to-speech",
      prompt,
    });

    console.log(res);
    return res;
  }

  export async function generate_tts() {
    if (QueueManager.isAudioQueueBlocked()) return;

    const item = QueueManager.pop("audio");
    assert(item.type === Event.NewAudioPrompt, "Incorrect event type!");

    const { prompt, id } = item;
    const res = await comfyClient.generate({
      id,
      kind: "text-to-speech",
      prompt,
    });

    console.log(res);
    return res;
  }
}
