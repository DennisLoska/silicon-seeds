import { comfyClient } from "../comfyui";
import { Event } from "../events/events";
import assert from "node:assert";

export namespace SocketServer {
  let ws: WebSocket;

  export function start() {
    // should be passed from job endpoint
    const clientId = Bun.randomUUIDv7();
    console.log(clientId);

    ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${clientId}`);

    ws.addEventListener("error", (error) => {
      console.log(error);
    });

    ws.addEventListener("open", () => {
      console.log("client connected");
    });

    ws.addEventListener("close", () => {
      console.log("client disconnected");
    });

    ws.addEventListener("message", async (event) => {
      let queue = 0;
      let promptId;

      const msg = JSON.parse(event.data);
      if (msg.type === "progress_state") {
        assert(
          msg.data.prompt_id,
          "progress_state without prompt_id encountered",
        );
        promptId = msg.data.prompt_id;
      }

      if (msg.type === "progress") {
        console.log(`step: ${msg.data.value}/${msg.data.value}`);
      }

      // for the video prompt
      if (msg.type === "status") {
        queue = msg.data?.status?.exec_info?.queue_remaining;
        console.log(`remaining: ${queue}`);

        if (msg.data?.status?.exec_info?.queue_remaining === 0) {
          Event.emit(Event.NewImage);
        }

        if (promptId && msg.data?.status?.exec_info?.queue_remaining === 0) {
          const history = await comfyClient.getHistory(promptId);
          const historyNode = history[promptId];

          for (const output of Object.values(historyNode?.outputs)) {
            const out = output as any;
            if (!out.images) continue;

            for (const image of out.images) {
              Event.emit(Event.NewImagePrompt, {
                ...image,
                kind: image.type,
                type: Event.NewImagePrompt,
              });
            }
          }
        }
      }
    });
  }

  export function stop() {
    ws.close();
  }
}
