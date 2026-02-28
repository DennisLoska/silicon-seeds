import { Event } from "./events/events";
import { ImageGenerator } from "./images/image-generator";
import { PromptGenerator } from "./prompts/prompt-generator";

ImageGenerator.init();
PromptGenerator.txt_to_img_prompt(
  "Jesus gets lead into the desert by the holy spirit.",
  50,
);

setTimeout(() => {
  console.log("warm up...");
  main();
}, 10_000);

let queue = 0;
async function main() {
  const clientId = Bun.randomUUIDv7();
  console.log(clientId);
  const ws = new WebSocket(`ws://127.0.0.1:8188/ws?clientId=${clientId}`);

  let promptId;
  ws.addEventListener("message", async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "progress_state") {
      console.assert(
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

      // if (promptId && msg.data?.status?.exec_info?.queue_remaining === 0) {
      //   const history = await comfyClient.getHistory(promptId);
      //   const historyNode = history[promptId];
      //   console.log(historyNode);
      //   for (const output of Object.values(historyNode?.outputs)) {
      //     const out = output as any;
      //     if (!out.images) continue;
      //     for (const image of out.images) {
      //       console.log(image);
      //     }
      //   }
      // }
      //
    }
  });

  ws.addEventListener("error", (error) => {
    console.log(error);
  });

  ws.addEventListener("open", () => {
    console.log("client connected");
  });

  ws.addEventListener("close", () => {
    console.log("client disconnected");
  });

  process.on("SIGINT", () => {
    ws.close();
    process.exit(1);
  });
}
