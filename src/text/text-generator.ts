import { LLM } from "../llm/llm";
import { PromptGenerator } from "../prompts/prompt-generator";

export namespace TextGenerator {
  export async function create_script(jobId: string, description: string) {
    // TODO emit event to save content in db
    return await LLM.message(PromptGenerator.script_prompt(description));
  }
}
