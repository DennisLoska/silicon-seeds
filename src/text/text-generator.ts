import { Event } from "../events/events";
import { LLM } from "../llm/llm";
import { PromptGenerator } from "../prompts/prompt-generator";

export namespace TextGenerator {
  export async function create_script(
    jobId: string,
    description: string,
  ): Promise<string | null> {
    const res = await LLM.message(PromptGenerator.script_prompt(description));
    if (!res?.content) return null;

    Event.emit(Event.NewText, {
      id: Bun.randomUUIDv7(),
      jobId,
      type: Event.NewText,
      text: res.content,
    });

    return res.content;
  }
}
