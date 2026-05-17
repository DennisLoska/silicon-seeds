import { FileHandle, LMStudioClient } from "@lmstudio/sdk";
import { Logger } from "../logger/logger";

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

  export async function structured_message(
    msg: string,
    schema: { parse: (input: unknown) => unknown },
  ) {
    try {
      return await llm.respond(msg, {
        structured: { type: "json", jsonSchema: schema },
        maxTokens: MAX_TOKENS,
      });
    } catch (error) {
      Logger.error("Failed to receive message from LLM", error);
      return null;
    }
  }
}
