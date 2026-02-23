import { LmStudioClient } from "./lib/lm-studio";
import { VideoClient, ZImageTurboClient } from "./lib/comfyui";

const lmStudioClient = new LmStudioClient({
  baseUrl: "http://127.0.0.1:1234",
  model: "qwen3-vl-30b",
});

const zImageTurboClient = new ZImageTurboClient({
  baseUrl: "http://127.0.0.1:8188",
});

const i2vClient = new VideoClient({
  baseUrl: "http://127.0.0.1:8188",
});

async function main() {
  try {
    // Generate an image prompt using LM Studio
    const prompt = await lmStudioClient.chatWithTextResponse(
      "Generate a detailed image generation prompt for a landscape with mountains.",
    );
    console.log("Generated prompt:", prompt);

    // Feed the generated prompt to ZImageTurbo client
    const result = await zImageTurboClient.generate({ prompt });
    console.log("ComfyUI image result:", result);

    // TODO get generated image url using the promptId from result (history endpoint does not exist yet)
    const res = await i2vClient.generate({
      imagePath: "",
      prompt: "identity",
    });

    console.log("ComfyUI video result:", res);
  } catch (error) {
    console.error("ComfyUI error:", error);
  }
}

main();
