import { PromptGenerator } from "../../prompts/prompt-generator";
import { TextGenerator } from "../../text/text-generator";

export async function text_to_script() {
  // TODO get these from query parameters
  const prompt = "A sermon about the parable of the Sower.";

  const text = PromptGenerator.script_prompt(prompt);
  const res = await TextGenerator.create_script(text);

  if (res === null) {
    return new Response(JSON.stringify({ message: "Computer says no" }), {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ message: res }));
}
