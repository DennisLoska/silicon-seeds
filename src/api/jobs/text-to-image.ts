import { PromptGenerator } from "../../prompts/prompt-generator";
import { Presets } from "../../styles/presets";

export async function text_to_image() {
  // TODO get the these from query parameters
  const prompt = "A sermon about the parable of the Sower.";
  const batchSize = 3;

  const jobId = Bun.randomUUIDv7();

  void PromptGenerator.txt_to_img_prompt(
    jobId,
    prompt,
    batchSize,
    Presets.WATERCOLOR,
  );

  return new Response(JSON.stringify({ message: "job queued" }));
}
