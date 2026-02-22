import { LmStudioClient, ImageInput } from "./lib/lm-studio-client";

const client = new LmStudioClient({
  baseUrl: "http://127.0.0.1:1234",
  model: "qwen3-vl-30b",
});

async function main() {
  const textOnlyResponse = await client.chatWithTextResponse(
    "You are a prompt engineer. Generate an image prompt of Lana the test image.",
  );
  console.log("Text response:", textOnlyResponse);

  // Example with base64 image (uncomment and provide valid base64)
  // const image: ImageInput = {
  //   base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  //   format: "png",
  // };
  // const visionResponse = await client.chatWithTextResponse(
  //   "Describe what's in this image.",
  //   { image }
  // );
  // console.log("Vision response:", visionResponse);
}

main();
