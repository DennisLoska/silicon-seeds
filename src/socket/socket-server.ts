import { comfyClient } from "../comfyui";
import { Event } from "../events/events";
import assert from "node:assert";

export namespace SocketServer {
  let ws: WebSocket;

  export function start(clientId = Bun.randomUUIDv7()) {
    // should be passed from job endpoint
    console.log(clientId);

    ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${clientId}`);

    ws.addEventListener("message", message);
    ws.addEventListener("error", error);
    ws.addEventListener("open", open);
    ws.addEventListener("close", close);
  }

  export function stop() {
    ws.close();
  }

  let promptId;
  async function message(event: MessageEvent) {
    let queue = 0;

    const msg = JSON.parse(event.data);
    if (msg.type === "progress_state") {
      assert(
        msg.data.prompt_id,
        "progress_state without prompt_id encountered",
      );
      promptId = msg.data.prompt_id;
    }

    if (msg.type === "progress") {
      console.log(`step: ${msg.data.value}/${msg.data.max}`);
    }

    // for the video prompt - how to get the actual job id here from job endpoint?
    if (msg.type === "status") {
      console.log(msg.data.exec_info);
      queue = msg.data?.status?.exec_info?.queue_remaining;
      console.log(`jobs remaining: ${queue}`);

      // trigger next image or video
      if (msg.data?.status?.exec_info?.queue_remaining === 0) {
        Event.emit(Event.NewImage);

        // TODO verify this works ...
        Event.emit(Event.NewVideo);
      }

      if (!promptId) return;

      const history = await comfyClient.getHistory(promptId);
      const historyNode = history[promptId];

      if (!historyNode?.outputs) {
        console.warn("Undefined history node (fix this)");
        return;
      }

      // trigger next video
      for (const output of Object.values(historyNode.outputs)) {
        const out = output as any;
        if (!out.images) continue;

        for (const image of out.images) {
          // TODO apparently this is also video so filter out videos, sigh what bad api design...
          if (image.subfolder === "video") {
            console.warn("Image of type video...");
            continue;
          }

          Event.emit(Event.NewImagePrompt, {
            ...image,
            kind: image.type,
            type: Event.NewImagePrompt,
          });
        }
      }
    }
  }

  function error(error: globalThis.Event) {
    console.log(error);
  }

  function open() {
    console.log("client connected");
  }

  function close() {
    console.log("client disconnected");
  }
}
