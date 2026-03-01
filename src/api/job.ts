import { PromptGenerator } from "../prompts/prompt-generator";

export async function job() {
  await PromptGenerator.txt_to_img_prompt(
    "Jesus gets lead into the desert by the holy spirit.",
    10,
  );

  return new Response(JSON.stringify({ message: "job queued" }));
}
