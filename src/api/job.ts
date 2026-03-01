import { PromptGenerator } from "../prompts/prompt-generator";

export function job() {
  PromptGenerator.txt_to_img_prompt("A random scene from the bible", 10);

  return new Response(JSON.stringify({ message: "job queued" }));
}
