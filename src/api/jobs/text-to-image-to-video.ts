import { JobMode } from "../../events/events";
import { PromptGenerator } from "../../prompts/prompt-generator";
import { Presets } from "../../styles/presets";

export async function text_to_image_to_video() {
  // TODO get the these from query parameters
  const prompt = "A sermon about the parable of the Sower.";
  const batchSize = 1;

  const jobId = Bun.randomUUIDv7();

  void PromptGenerator.txt_to_img_prompt(
    jobId,
    JobMode.Video,
    prompt,
    batchSize,
    Presets.WATERCOLOR,
  );

  return new Response(JSON.stringify({ message: "job queued" }));
}
