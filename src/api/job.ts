import { PromptGenerator } from "../prompts/prompt-generator";
import { Presets } from "../styles/presets";

export async function job() {
  // TODO get the these from query parameters
  const prompt = "A random scene from the bible";
  const batchSize = 3;

  PromptGenerator.txt_to_img_prompt(prompt, batchSize, Presets.WATERCOLOR);

  return new Response(JSON.stringify({ message: "job queued" }));
}
