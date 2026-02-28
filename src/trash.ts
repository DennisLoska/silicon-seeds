import { comfyClient, ComfyUIClient } from "./lib/comfyui";
import { LmStudioClient } from "./lib/lm-studio";

const COMFYUI_OUTPUT_DIR = "/run/media/dennis/ai/comfy-ui/output";

type ImageMetadata = {
  filename: string;
  subfolder: string;
  type: "input" | "output" | "temp";
};

export const lmStudioClient = new LmStudioClient({
  baseUrl: "http://127.0.0.1:1234",
  model: "qwen/qwen3-vl-30b",
});

let queue = 0;
let counter = 0;
const file = Bun.file("src/prompts/biblical_1772141536073.txt");
const prompts = await file.text();
const lines = prompts.split("\n");
let image_promtps: { prompt: string; filename: string }[] = [];

async function queueImage() {
  // console.log("genearing the image prompt...");
  // const prompt = await lmStudioClient.chatWithTextResponse(
  //   "Generate a detailed image generation prompt for a random anime style image",
  // );
  // console.log(prompt);

  if (lines.length > 0 && queue === 0) {
    counter++;
    console.log(counter);
    const line = lines.shift();
    if (!line) return;

    console.log("Generating image for prompt: \n");
    console.log(line);
    await comfyClient.generate({ kind: "text-to-image", prompt: line });
  }
}

async function createImgPrompts(image: ImageMetadata) {
  const img = await comfyClient.getImage(
    image.filename,
    image.subfolder,
    image.type,
  );

  const buffer = await img.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  console.log("Generating the video prompt...");
  const prompt = await lmStudioClient.chatWithTextResponse(
    "Generate a detailed video generation prompt for a 5 second long video based on the image",
    { image: { format: "png", base64 } },
  );

  console.log(prompt);
  image_promtps.push({
    prompt,
    filename: image.filename,
  });
}

async function queueVideo() {
  if (lines.length > 0 || queue > 0 || image_promtps.length <= 0) return;

  const item = image_promtps.shift();
  if (!item) return;
  console.log("Generating the video");

  const res = await comfyClient.generate({
    kind: "image-to-video",
    prompt: item.prompt,
    imagePath: `${COMFYUI_OUTPUT_DIR}/${item.filename}`,
  });
  console.log(res);
}

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

    if (msg.type === "status") {
      queue = msg.data?.status?.exec_info?.queue_remaining;
      console.log(msg.data);
      if (promptId && msg.data?.status?.exec_info?.queue_remaining === 0) {
        const history = await comfyClient.getHistory(promptId);
        const historyNode = history[promptId];
        console.log(historyNode);

        for (const output of Object.values(historyNode?.outputs)) {
          const out = output as any;
          if (!out.images) continue;
          for (const image of out.images) {
            console.log(image);
            await createImgPrompts(image);
          }
        }
      }

      await queueImage();
      await queueVideo();
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
  });

  queueImage();
}

main();
