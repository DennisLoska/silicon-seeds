import { PromptGenerator } from "../../prompts/prompt-generator";
import { Presets } from "../../styles/presets";

export async function script_to_scenes() {
  // TODO get these from query parameters
  const script = "A sermon about the parable of the Sower.";

  const jobId = Bun.randomUUIDv7();

  void PromptGenerator.image_scene_prompts(
    jobId,
    script,
    // TODO calculate length using AudioGenerator -> TTS
    10,
    Presets.WATERCOLOR,
  );

  return new Response(JSON.stringify({ message: "job queued" }));
}
