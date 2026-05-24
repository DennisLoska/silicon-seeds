import { JobMode } from "../../events/events";
import { JobOrchestrator } from "../../jobs/jobs";
import { PromptGenerator } from "../../prompts/prompt-generator";
import { Utils } from "../../utils/utils";
import { PostTextToImage } from "../schemas";

export async function text_to_image(options: PostTextToImage): Promise<Response> {
  const { resolution, image_model, style_preset, batch_size } = options;
  const prompt = Utils.sanitizeInputText(options.prompt);

  if (!prompt) {
    throw new Error("Prompt is required");
  }

  const { id: jobId } = await JobOrchestrator.create_job({
    original_prompt: prompt,
    resolution,
    image_model,
    style_preset,
  });

  const batchSize = batch_size;
  void PromptGenerator.txt_to_img_prompt(
    jobId,
    JobMode.Image,
    prompt,
    batchSize,
    options.style_preset,
  );

  return new Response(JSON.stringify({ message: "job queued" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "HX-Redirect": `/create/image?show_progress=true&job_id=${jobId}`,
    },
  });
}
