import { ImageGenerator } from "../image/image-generator";
import { Metadata } from "../meta/meta";
import { PromptGenerator } from "../prompts/prompt-generator";
import { QueueManager } from "../queue/queue-manager";
import assert from "node:assert";
import { VideoGenerator } from "../video/video-generator";
import { comfyClient } from "../comfyui/comfyui-client";
import { Event, JobEvent, JobMode } from "../events/events";
import { AudioGenerator } from "../audio/audio-generator";
import { JobOrchestrator } from "../jobs/jobs";
import { Logger } from "../logger/logger";

export namespace SocketServer {
  let ws: WebSocket;
  let currentEvent: JobEvent;

  export async function start() {
    ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${Metadata.clientId}`);

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
      const { prompt_id: promptId } = msg.data;

      QueueManager.comfyQueue--;
      // TODO find in actual db
      const event = QueueManager.findEventById(promptId);
      assert(event, "Event is missing");

      // update status to complete
      JobOrchestrator.update_schedule({ ...event, status: "complete" });
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

      if (event.type === Event.NewVideoPrompt && event.mode === JobMode.Video) {
        const transitions = await VideoGenerator.prepare_transitions(event);
        if (!transitions) return;

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
