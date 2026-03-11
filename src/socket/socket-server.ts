import { ImageGenerator } from "../image/image-generator";
import { Metadata } from "../meta/meta";
import { PromptGenerator } from "../prompts/prompt-generator";
import { QueueManager } from "../queue/queue-manager";
import assert from "node:assert";
import { VideoGenerator } from "../video/video-generator";
import { comfyClient } from "../comfyui/comfyui-client";
import { Event, JobEvent, JobMode } from "../events/events";
import { AudioGenerator } from "../audio/audio-generator";

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
      console.log(`Progress: ${msg.data.value}/${msg.data.max}`);
    }

    if (msg.type === "status") {
      QueueManager.comfyQueue = msg.data?.status?.exec_info?.queue_remaining;
      console.log(`Jobs in ComfyUI queue: ${QueueManager.comfyQueue}`);
      console.log("Image queue: ", QueueManager.imageQueue.length);
      console.log("Video queue: ", QueueManager.videoQueue.length);
      console.log("Audio queue: ", QueueManager.audioQueue.length);
    }

    if (msg.type === "execution_start") {
      const { prompt_id: promptId } = msg.data;
      const current = QueueManager.findEventById(promptId);
      if (current) currentEvent = current;
    }

    if (msg.type === "executed") {
      // console.log("\n===executed===\n");
      // console.log(JSON.stringify(msg.data));

      // Can be used to enrich REST api responses
      Event.emit(Event.ComfyExecuted, {
        id: msg.data.prompt_id,
        data: msg.data.output,
      });
    }

    if (msg.type === "execution_success") {
      const { prompt_id: promptId } = msg.data;

      QueueManager.comfyQueue--;
      const event = QueueManager.findEventById(promptId);
      assert(event, "Event is missing");

      // better memory management
      if (
        (QueueManager.imageQueue.length === 0 &&
          currentEvent.mode === JobMode.Image) ||
        (QueueManager.videoQueue.length === 0 &&
          currentEvent.mode === JobMode.Video)
      ) {
        await comfyClient.free_memory(true, true);
      }

      // always attempt to queue next items
      ImageGenerator.generate_image();
      VideoGenerator.generate_video();
      AudioGenerator.generate_audio();

      if (event.mode === JobMode.Video) {
        PromptGenerator.img_to_vid_prompt(promptId);
      }
    }
  }

  function error(error: globalThis.Event) {
    console.log(error);
  }

  function open() {
    console.log(
      `Socket with client id ${Metadata.clientId} connected to ComfyUI\n`,
    );
  }

  function close() {
    console.log("Connection closed\n");
  }
}
