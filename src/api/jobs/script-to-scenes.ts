import { JobMode } from "../../events/events";
import { PromptGenerator } from "../../prompts/prompt-generator";
import { Presets } from "../../styles/presets";
import { text_to_script } from "./text-to-script";

export async function script_to_scenes() {
  // TODO get these from query parameters
  // const script = "A sermon about the parable of the Sower.";

  const jobId = Bun.randomUUIDv7();

  // TODO pass as post body instead
  const res = await text_to_script();
  const json = await res.json();
  const script = json.message;

  if (!script) return new Response(JSON.stringify({ message: "Oh no" }));

  void PromptGenerator.image_scene_prompts(
    jobId,
    JobMode.Video,
    script,
    // TODO calculate length using AudioGenerator -> TTS
    40,
    Presets.WATERCOLOR,
  );

  return new Response(JSON.stringify({ message: "job queued" }));
}
