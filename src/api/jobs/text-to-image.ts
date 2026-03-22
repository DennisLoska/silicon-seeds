import { JobMode } from "../../events/events";
import { JobOrchestrator } from "../../jobs/jobs";
import { PromptGenerator } from "../../prompts/prompt-generator";
import { Presets } from "../../styles/presets";

export async function text_to_image() {
  // TODO get the these from query parameters
  const prompt =
    "epic surreal landscape, lightrays, fractals, nature, meaningful, wide, ancient, desert, ocean, mountains, ether, void, spirit, wind, stars, universe, gothic, wonderland, solitude, calm, peace, beautiful, no people";
  const batchSize = 3;

  const { id: jobId } = await JobOrchestrator.create_job();

  void PromptGenerator.txt_to_img_prompt(
    jobId,
    JobMode.Image,
    prompt,
    batchSize,
    Presets.PENCIL_WATERCOLOR,
  );

  return new Response(JSON.stringify({ message: "job queued" }));
}
