import { AudioGenerator } from "../audio/audio-generator";
import { DB } from "../db/db";
import { Event, JobEvent } from "../events/events";
import { ImageGenerator } from "../image/image-generator";
import { Logger } from "../logger/logger";
import { VideoGenerator } from "../video/video-generator";

export namespace QueueManager {
  export let comfyQueue = 0;
  let pumping = false;

  export async function resume() {
    await DB.Events.requeueRunning();
  }

  export async function pump() {
    if (pumping) return;
    pumping = true;

    try {
      if (await DB.Events.hasRunning()) return;

      const event = await DB.Events.claimNextRunnable();
      if (!event) return;

      await dispatch(event);
    } finally {
      pumping = false;
    }
  }

  async function dispatch(event: JobEvent) {
    Logger.info("Dispatching queued event", {
      id: event.id,
      type: event.type,
      mode: event.mode,
      priority: event.priority,
    });

    try {
      if (event.type === Event.NewAudioPrompt) {
        await AudioGenerator.generate_audio(event);
        return;
      }

      if (event.type === Event.NewImagePrompt) {
        await ImageGenerator.generate_image(event);
        return;
      }

      if (
        event.type === Event.NewVideoPrompt ||
        event.type === Event.NewTransitionPrompt
      ) {
        await VideoGenerator.generate_video(event);
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.error("Failed to dispatch queued event", { id: event.id, message });
      await DB.Jobs.failJob(event.jobId);
      queueMicrotask(() => {
        void pump();
      });
    }
  }
}
