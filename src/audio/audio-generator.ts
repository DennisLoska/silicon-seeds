import { comfyClient, ModelVariant } from "../comfyui/comfyui-client";
import { AudioPromptEvent, Event, JobMode } from "../events/events";
import { Metadata } from "../meta/meta";
import { PromptGenerator } from "../prompts/prompt-generator";
import { QueueManager } from "../queue/queue-manager";
import { JobOrchestrator } from "../jobs/jobs";
import { Presets } from "../styles/presets";
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
    mode?: JobMode.Speech | JobMode.Instrumental;
    lyrics?: string;
    audio_settings?: Record<string, unknown>;
  }) {
    return await JobOrchestrator.schedule_task({
      ...event,
      type: Event.NewAudioPrompt,
      mode: event.mode ?? (event.prompt ? JobMode.Speech : JobMode.Instrumental),
    });
  }

  export async function generate_audio(item: AudioPromptEvent) {
    const job = await DB.Jobs.findById(item.jobId);
    Utils.assert(item.type === Event.NewAudioPrompt, "Incorrect event type!");

    const { prompt, id, mode, duration, lyrics, audio_settings } = item;

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
        lyrics: lyrics ?? null,
        settings: audio_settings,
      };

      await comfyClient.generate(modelVariant, job);
    }
  }

  export async function handle_speech_complete(event: AudioPromptEvent) {
    Utils.assert(
      event.mode === JobMode.Speech,
      "Speech completion handler requires a speech event",
    );

    const metadata = await DB.Meta.findByEventId(event.id);
    const audioBlob = await comfyClient.getAsset(
      metadata.filename,
      metadata.subfolder,
      metadata.type,
    );

    const duration = await Metadata.getAudioDuration(audioBlob);
    const job = await DB.Jobs.findById(event.jobId);
    await schedule_audio({
      jobId: event.jobId,
      duration,
    });

    const clipDuration = job.clip_duration || Metadata.CLIP_DURATION;
    const transitionDuration =
      job.transition_duration || Metadata.TRANSITION_DURATION;
    const clipCount = Math.ceil(
      (duration + transitionDuration) / (clipDuration + transitionDuration),
    );

    const textEvents = (await DB.Events.findByJobId(event.jobId)).filter(
      (item) => item.type === Event.NewTextPrompt,
    );
    const scriptEvent = textEvents[0];

    if (scriptEvent?.type === Event.NewTextPrompt) {
      await PromptGenerator.image_scene_prompts(
        event.jobId,
        JobMode.Video,
        scriptEvent.text,
        clipCount,
        job.style_preset as Presets | undefined,
      );
    }
  }
}
