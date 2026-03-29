import { ImageGenerator } from "../image/image-generator";
import { Metadata } from "../meta/meta";
import { PromptGenerator } from "../prompts/prompt-generator";
import { QueueManager } from "../queue/queue-manager";
import { VideoGenerator } from "../video/video-generator";
import { comfyClient } from "../comfyui/comfyui-client";
import { Event, JobEvent, JobMode, JobStatus } from "../events/events";
import { AudioGenerator } from "../audio/audio-generator";
import { JobOrchestrator } from "../jobs/jobs";
import { Logger } from "../logger/logger";
import { Utils } from "../utils/utils";
import { DB } from "../db/db";

export namespace SocketServer {
  let ws: WebSocket;
  let currentEvent: JobEvent;

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
    const msg = JSON.parse(event.data);

    if (msg.type === "progress") {
      Logger.info(`Progress: ${msg.data.value}/${msg.data.max}`);
    }

    if (msg.type === "status") {
      QueueManager.comfyQueue = msg.data?.status?.exec_info?.queue_remaining;
      Logger.info(`Jobs in ComfyUI queue: ${QueueManager.comfyQueue}`);
      Logger.info(`Image queue: ${QueueManager.imageQueue.length}`);
      Logger.info(`Video queue: ${QueueManager.videoQueue.length}`);
      Logger.info(`Audio queue: ${QueueManager.audioQueue.length}`);
    }

    if (msg.type === "execution_start") {
      const { prompt_id: promptId } = msg.data;
      const current = QueueManager.findEventById(promptId);
      if (current) currentEvent = current;
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

      QueueManager.comfyQueue--;

      const event = await DB.Events.findById(promptId);
      Utils.assert(event, "Event is missing");

      // update status to complete
      JobOrchestrator.update_schedule({ ...event, status: JobStatus.Complete });
      const currentJob = JobOrchestrator.jobs[event.jobId];
      Logger.info("current job: ", currentJob);

      // better memory management
      if (
        (QueueManager.imageQueue.length === 0 &&
          currentEvent.mode === JobMode.Image) ||
        (QueueManager.videoQueue.length === 0 &&
          currentEvent.mode === JobMode.Video) ||
        (QueueManager.audioQueue.length === 0 &&
          currentEvent.mode === JobMode.Instrumental)
      ) {
        await comfyClient.free_memory(true, true);
      }

      // always attempt to queue next items
      ImageGenerator.generate_image();
      VideoGenerator.generate_video();
      AudioGenerator.generate_audio();

      if (event.type === Event.NewImagePrompt && event.mode === JobMode.Video) {
        PromptGenerator.img_to_vid_prompt(promptId);
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
            VideoGenerator.schedule_transition({
              jobId: event.jobId,
              prompt: transition.prompt,
              startImg: transition.first,
              endImg: transition.last,
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
        return;
      }

      const events = JobOrchestrator.job_events(event.jobId);
      const allComplete = events
        .filter(
          (e) =>
            e.type === Event.NewImagePrompt ||
            e.type === Event.NewVideoPrompt ||
            e.type === Event.NewTransitionPrompt,
        )
        .every((e) => e.status === "complete");

      Logger.info("Job complete?", {
        allComplete,
      });

      if (allComplete) {
        Logger.info(`Triggering video combiner for job ${currentJob.id}`);
        void VideoGenerator.combine_outputs(currentJob.id);
      }
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
