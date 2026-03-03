import { PromptGenerator } from "../../prompts/prompt-generator";
import { Presets } from "../../styles/presets";
import { TextGenerator } from "../../text/text-generator";
import assert from "node:assert";

// TODO rename and move to make more generic
export async function text_to_text() {
  // TODO get these from query parameters
  const prompt = "A sermon about the parable of the Sower.";
  const batchSize = 2;

  const jobId = Bun.randomUUIDv7();

  const jobs = Array.from({ length: batchSize }, async () => {
    const text = PromptGenerator.script_prompt(prompt);
    const content = await TextGenerator.create_script(text);
    assert(content, "Content is missing!");

    // TODO remove this from this api endpoint when moving it
    await PromptGenerator.image_scene_prompts(
      jobId,
      content,
      // TODO calculate length using AudioGenerator -> TTS
      10,
      Presets.WATERCOLOR,
    );
  });

  void Promise.all(jobs);

  return new Response(JSON.stringify({ message: "job queued" }));
}
