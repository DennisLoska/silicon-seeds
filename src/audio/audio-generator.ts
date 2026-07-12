import { comfyClient, ModelVariant } from "../comfyui/comfyui-client";
import { AudioPromptEvent, Event, JobMode } from "../events/events";
import { QueueManager } from "../queue/queue-manager";
import { JobOrchestrator } from "../jobs/jobs";
import { TTS } from "../tts/tts";
import { Utils } from "../utils/utils";
import { DB } from "../db/db";

export namespace AudioGenerator {
  export async function schedule_audio(event: {
    id?: string;
    jobId: string;
    prompt?: string;
    duration?: number;
    mode?: JobMode.Speech | JobMode.Song | JobMode.Instrumental;
    lyrics?: string;
    audio_settings?: Record<string, unknown>;
    voice_id?: string;
  }) {
    const task = await JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewAudioPrompt,
      mode:
        event.mode ?? (event.prompt ? JobMode.Speech : JobMode.Instrumental),
    });
    await QueueManager.pump();

    return task;
  }

  export async function generate_audio(
    item: AudioPromptEvent,
  ): Promise<{ duration?: number }> {
    const job = await DB.Jobs.findById(item.jobId);
    Utils.assert(item.type === Event.NewAudioPrompt, "Incorrect event type!");

    const { prompt, id, mode, duration, lyrics, audio_settings } = item;

    if (mode === JobMode.Speech) {
      Utils.assert(typeof prompt === "string", "'prompt' is not a string");
      Utils.assert(item.voice_id, "Speech mode requires voice_id");

      const result = await TTS.generate({
        id,
        jobId: item.jobId,
        text: prompt,
        voiceId: item.voice_id,
        language: audio_settings?.language as string | undefined,
      });

      await DB.Meta.create({
        event_id: id,
        filename: result.filename,
        subfolder: "",
        type: "output",
      });

      await DB.Events.markComplete(id);

      return { duration: result.duration };
    }

    if (mode === JobMode.Instrumental) {
      Utils.assert(duration && duration > 0, "'duration' is not a number");
      const modelVariant: ModelVariant = {
        id,
        kind: "text-to-instrumental",
        prompt: prompt ?? null,
        duration,
        lyrics: lyrics ?? null,
        settings: audio_settings,
      };

      await comfyClient.generate(modelVariant, job);
      return {};
    }

    if (mode === JobMode.Song) {
      Utils.assert(duration && duration > 0, "'duration' is not a number");
      const modelVariant: ModelVariant = {
        id,
        kind: "text-to-song",
        prompt: prompt ?? null,
        duration,
        lyrics: lyrics ?? null,
        settings: audio_settings,
      };

      await comfyClient.generate(modelVariant, job);
      return {};
    }

    return {};
  }
}
