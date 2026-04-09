import { LLM } from "../llm/llm";
import { PromptGenerator } from "../prompts/prompt-generator";
import { DB } from "../db/db";
import { Event, JobMode, JobStatus, TextPromptEvent } from "../events/events";
import { Metadata } from "../meta/meta";

export namespace TextGenerator {
  export async function text(instruction: string): Promise<string | null> {
    const res = await LLM.message(instruction);
    if (!res?.content) return null;

    return res.content;
  }

  export async function create_text_event(jobId: string, text: string) {
    const textEvent: TextPromptEvent = {
      id: Metadata.randomId(),
      jobId,
      mode: JobMode.Text,
      status: JobStatus.Complete,
      prompt: "n/a",
      type: Event.NewTextPrompt,
      text,
    };

    await DB.Events.create(textEvent);
  }

  export async function create_script(
    description: string,
  ): Promise<string | null> {
    const res = await LLM.message(PromptGenerator.script_prompt(description));
    if (!res?.content) return null;

    return res.content;
  }
}
