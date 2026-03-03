import { LLM } from "../llm/llm";
import { PromptGenerator } from "../prompts/prompt-generator";

export namespace TextGenerator {
  // TODO create generating chat function
  export async function create_script(
    description: string,
  ): Promise<string | null> {
    const res = await LLM.message(PromptGenerator.script_prompt(description));
    if (!res?.content) return null;

    return res.content;
  }
}
