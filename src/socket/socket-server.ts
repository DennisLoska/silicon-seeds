import { ImageGenerator } from "../image/image-generator";
import { Metadata } from "../meta/meta";
import { PromptGenerator } from "../prompts/prompt-generator";
import { QueueManager } from "../queue/queue-manager";
import { VideoGenerator } from "../video/video-generator";
import { comfyClient } from "../comfyui/comfyui-client";
import { Event, JobMode, JobStatus } from "../events/events";
import { AudioGenerator } from "../audio/audio-generator";
import { JobOrchestrator } from "../jobs/jobs";
import { Logger } from "../logger/logger";
import { Utils } from "../utils/utils";
import { DB } from "../db/db";

export namespace SocketServer {
  let ws: WebSocket;

  export async function start() {
    ws = new WebSocket(
      `${Bun.env.COMFYUI_BASE_WS}/ws?clientId=${Metadata.clientId}`,
    );

    ws.addEventListener("message", message);
    ws.addEventListener("error", error);
    ws.addEventListener("open", open);
    ws.addEventListener("close", close);

    await comfyClient.free_memory(true, true);
  }

  export function stop() {
    ws.close();
  }

  async function message(event: MessageEvent) {
    let msg;
    if (typeof event.data === "string") {
      Logger.debug("MESSAGE", event.data);
      msg = JSON.parse(event.data);
    } else {
      // Utils.assert(
      //   typeof event.data === "string",
      //   "We ain't buffin' around here!",
      // );
      Logger.warn("Received buffer, not string", event.data.toString("utf-8"));
    }

    if (msg.type === "progress") {
      Logger.info(`Progress: ${msg.data.value}/${msg.data.max}`);
    }

    if (msg.type === "status") {
      QueueManager.comfyQueue = msg.data?.status?.exec_info?.queue_remaining;
      Logger.info(`Jobs in ComfyUI queue: ${QueueManager.comfyQueue}`);
    }

    if (msg.type === "executed") {
      Logger.info("===executed===", msg.data);

      // Can be used to enrich REST api responses
      // Can be used to enrich job events
      Event.emit(Event.ComfyExecuted, {
        id: msg.data.prompt_id,
        created_at: new Date().toISOString(),
        data: msg.data.output,
      });
    }

    if (msg.type === "execution_success") {
      Logger.info("===execution_success===");
      const { prompt_id: promptId } = msg.data;

      const event = await DB.Events.findById(promptId);
      Utils.assert(event, "Event is missing");

      // update status to complete
      await JobOrchestrator.update_schedule({
        ...event,
        status: JobStatus.Complete,
      });

      await comfyClient.free_memory(true, true);

      if (event.type === Event.NewImagePrompt && event.mode === JobMode.Video) {
        await PromptGenerator.img_to_vid_prompt(promptId);
      }

      if (
        event.type === Event.NewAudioPrompt &&
        event.mode === JobMode.Speech
      ) {
        const metadata = await DB.Meta.findByEventId(event.id);
        const audioBlob = await comfyClient.getAsset(
          metadata.filename,
          metadata.subfolder,
          metadata.type,
        );

        const duration = await Metadata.getAudioDuration(audioBlob);
        const job = await DB.Jobs.findById(event.jobId);
        await AudioGenerator.schedule_audio({
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
            job.style_preset as any,
          );
        }
      }

      if (
        event.type === Event.NewVideoPrompt ||
        event.type === Event.NewTransitionPrompt
      ) {
        Logger.info("Saving video or transition to /tmp");

        try {
          const metadata = await DB.Meta.findByEventId(event.id);
          const videoBlob = await comfyClient.getAsset(
            metadata.filename,
            metadata.subfolder,
            metadata.type,
          );

          const tmpFile = `/tmp/${event.jobId}_${event.id}.mp4`;
          await Bun.write(tmpFile, await videoBlob.arrayBuffer());
        } catch (error) {
          Logger.error("Failed to create video or transition", error);
        }
      }

      if (event.type === Event.NewVideoPrompt && event.mode === JobMode.Video) {
        const transitions = await VideoGenerator.prepare_transitions(event);

        if (transitions) {
          for (const transition of transitions) {
            await VideoGenerator.schedule_transition({
              jobId: event.jobId,
              prompt: transition.prompt,
              startImg: transition.first,
              endImg: transition.last,
              index: transition.index,
            });
          }
        }
      }

      if (
        !(
          event.type === Event.NewVideoPrompt ||
          event.type === Event.NewTransitionPrompt
        )
      ) {
        Logger.info("Not a video or transition event");
        void QueueManager.pump();
        return;
      }

      const events = await JobOrchestrator.job_events(event.jobId);
      const allComplete = events
        .filter(
          (e) =>
            e.type === Event.NewImagePrompt ||
            e.type === Event.NewVideoPrompt ||
            e.type === Event.NewTransitionPrompt,
        )
        .every((e) => e.status === JobStatus.Complete);

      Logger.info("Job complete?", {
        allComplete,
      });

      if (allComplete) {
        Logger.info(`Triggering video combiner for job ${event.jobId}`);
        void VideoGenerator.combine_outputs(event.jobId);
      }

      await DB.Jobs.finalizeCompletedJobs();

      void QueueManager.pump();
    }
  }

  function error(error: globalThis.Event) {
    Logger.info("Socket error: ", error);
  }

  function open() {
    Logger.info(
      `Socket with client id ${Metadata.clientId} connected to ComfyUI`,
    );
  }

  function close() {
    Logger.info("Connection closed\n");
  }
}
