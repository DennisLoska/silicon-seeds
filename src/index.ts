import { LmStudioClient } from "./lib/lm-studio";
import { ZImageTurboClient } from "./lib/comfyui";

const lmStudioClient = new LmStudioClient({
  baseUrl: "http://127.0.0.1:1234",
  model: "qwen3-vl-30b",
});

const zImageTurboClient = new ZImageTurboClient({
  baseUrl: "http://127.0.0.1:8188",
});

async function main() {
  // Generate an image prompt using LM Studio
  const prompt = await lmStudioClient.chatWithTextResponse(
    "Generate a detailed image generation prompt for a landscape with mountains.",
  );
  console.log("Generated prompt:", prompt);

  // Feed the generated prompt to ZImageTurbo client
  try {
    const result = await zImageTurboClient.generate({ prompt });
    console.log("ComfyUI result:", result);
  } catch (error) {
    console.error("ComfyUI error:", error);
  }
}

main();
