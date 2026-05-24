import { FileHandle, LMStudioClient } from "@lmstudio/sdk";
import { Logger } from "../logger/logger";
import z from "zod/v3";

const llmClient = new LMStudioClient();
// const llm = await llmClient.llm.model(
//   "qwen3.6-27b-claude-opus-reasoning-distill-v2",
// );
// const llm = await llmClient.llm.model("qwen/qwen3-vl-30b");
// const llm = await llmClient.llm.model("qwen/qwen3-vl-4b");
// const llm = await llmClient.llm.model("qwen/qwen3-vl-8b");
const llm = await llmClient.llm.model("qwen3.6-35b-a3b");

export namespace LLM {
  export const client = llmClient;
  const MAX_TOKENS = 10_000;

  export async function message(msg: string, images?: FileHandle[]) {
    try {
      if (images) {
        return await llm.respond(
          { role: "user", content: msg, images },
          { maxTokens: MAX_TOKENS },
        );
      }

      return await llm.respond(
        { role: "user", content: msg },
        { maxTokens: MAX_TOKENS },
      );
    } catch (error) {
      Logger.error("Failed to receive message from LLM", error);
      return null;
    }
  }

  export async function image_prompt_list(msg: string, amount: number) {
    let mapSchema: any = {};
    for (let i = 0; i < amount; i++) {
      if (!mapSchema[i]) mapSchema[i] = z.string();
    }

    try {
      // Why TypeScript :(
      const typedSchema = z.object(mapSchema);

      return await llm.respond(msg, {
        structured: typedSchema,
        maxTokens: MAX_TOKENS,
      });
    } catch (error) {
      Logger.error("Failed to receive message from LLM", error);
      return null;
    }
  }

  export async function structured<T extends z.ZodTypeAny>(
    msg: string,
    schema: T,
  ) {
    try {
      return (await llm.respond(msg, {
        structured: schema,
        maxTokens: MAX_TOKENS,
      })) as unknown as { parsed: z.infer<T> } | null;
    } catch (error) {
      Logger.error("Failed to receive structured message from LLM", error);
      return null;
    }
  }
}
