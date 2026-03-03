import { ImageGenerator } from "../image/image-generator";
import { Metadata } from "../meta/meta";
import { PromptGenerator } from "../prompts/prompt-generator";
import { QueueManager } from "../queue/queue-manager";

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
      QueueManager.comfyQueueCounter =
        msg.data?.status?.exec_info?.queue_remaining;
      console.log(`Jobs in ComfyUI queue: ${QueueManager.comfyQueueCounter}\n`);
    }

    if (msg.type === "execution_success") {
      const { prompt_id: promptId } = msg.data;

      // TODO refactor this and get the values from the emitted events:
      // api/job/x -> emit event in PromptGenerator -> check event here using
      // promptId to verify which job it is: image, video, script, n, ...
      const wantImage = true;
      const wantVideo = false;
      if (wantImage) {
        ImageGenerator.generate_image();
      }

      if (wantVideo) {
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
