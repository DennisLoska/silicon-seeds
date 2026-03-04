import { JobMode } from "../events/events";
import { ImageGenerator } from "../image/image-generator";
import { Metadata } from "../meta/meta";
import { PromptGenerator } from "../prompts/prompt-generator";
import { QueueManager } from "../queue/queue-manager";
import assert from "node:assert";

export namespace SocketServer {
  let ws: WebSocket;

  export function start() {
    ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${Metadata.clientId}`);

    ws.addEventListener("message", message);
    ws.addEventListener("error", error);
    ws.addEventListener("open", open);
    ws.addEventListener("close", close);
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
    }

    if (msg.type === "execution_success") {
      const { prompt_id: promptId } = msg.data;

      QueueManager.comfyQueue--;
      const event = QueueManager.findEventById(promptId);
      assert(event, "Event is missing");

      if (event.mode === JobMode.Image) {
        ImageGenerator.generate_image();
      }

      // TODO Need two modes actually:
      // - text to video
      // - image to video
      if (event.mode === JobMode.Video) {
        // TODO free VRAM from image models first to improve performance
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
