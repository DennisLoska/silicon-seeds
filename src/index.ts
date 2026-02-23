import { ComfyUIClient } from "./lib/comfyui";
import { LmStudioClient } from "./lib/lm-studio";

const COMFYUI_OUTPUT_DIR = "/run/media/dennis/ai/comfy-ui/output";

type ImageMetadata = {
  filename: string;
  subfolder: string;
  type: "input" | "output" | "temp";
};

const lmStudioClient = new LmStudioClient({
  baseUrl: "http://127.0.0.1:1234",
  model: "qwen/qwen3-vl-8b",
});

const comfyClient = new ComfyUIClient({
  baseUrl: "http://127.0.0.1:8188",
});

async function queueImage() {
  console.log("genearing the image prompt...");
  const prompt = await lmStudioClient.chatWithTextResponse(
    "Generate a detailed image generation prompt for a random anime style image",
  );
  console.log(prompt);

  comfyClient.generate({ kind: "text-to-image", prompt });
}

async function queueVideo(image: ImageMetadata) {
  const img = await comfyClient.getImage(
    image.filename,
    image.subfolder,
    image.type,
  );

  const buffer = await img.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  console.log("genearing the video prompt...");
  const prompt = await lmStudioClient.chatWithTextResponse(
    "Generate a detailed video generation prompt for a 5 second long video based on the image",
    { image: { format: "png", base64 } },
  );
  console.log(prompt);

  console.log("Generating the video");
  const res = await comfyClient.generate({
    kind: "image-to-video",
    prompt,
    imagePath: `${COMFYUI_OUTPUT_DIR}/${image.filename}`,
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
      console.log(msg.data);
      if (promptId && msg.data?.status?.exec_info?.queue_remaining === 0) {
        const history = await comfyClient.getHistory(promptId);
        const historyNode = history[promptId];

        for (const output of Object.values(historyNode?.outputs)) {
          const out = output as any;
          if (!out.images) continue;
          for (const image of out.images) {
            console.log(image);
            await queueVideo(image);
          }
        }

        queueImage();
      }
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
