import { PromptGenerator } from "../prompts/prompt-generator";
import { Presets } from "../styles/presets";
import { TextGenerator } from "../text/text-generator";
import assert from "node:assert";

export async function job() {
  // TODO get the these from query parameters
  const prompt = "A random scene from the bible";
  const batchSize = 1;

  // TODO low level api -> move to different api endpoint
  // PromptGenerator.txt_to_img_prompt(prompt, batchSize, Presets.WATERCOLOR);

  // TODO use it
  const jobId = Bun.randomUUIDv7();

  const jobs = Array.from({ length: batchSize }, async () => {
    // const text = PromptGenerator.script_prompt(prompt);
    // const content = await TextGenerator.create_script(jobId, text);
    // assert(content, "Content is missing!");

    await PromptGenerator.image_scene_prompts(
      jobId,
      "The story ended so it does not matter.",
      1,
      Presets.WATERCOLOR,
    );
  });

  Promise.all(jobs);

  return new Response(JSON.stringify({ message: "job queued" }));
}
