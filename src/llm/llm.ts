import { FileHandle, LMStudioClient } from "@lmstudio/sdk";
import { Logger } from "../logger/logger";

const llmClient = new LMStudioClient();
const llm = await llmClient.llm.model("qwen/qwen3-vl-30b");
// const llm = await llmClient.llm.model("qwen/qwen3-vl-4b");
// const llm = await llmClient.llm.model("qwen/qwen3.5-35b-a3b");
// const llm = await llmClient.llm.model("qwen/qwen3.5-9b");

export namespace LLM {
  export const client = llmClient;

  export async function message(msg: string, images?: FileHandle[]) {
    try {
      if (images) {
        return await llm.respond({ role: "user", content: msg, images });
      }

      return await llm.respond({ role: "user", content: msg });
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
      });
    } catch (error) {
      Logger.error("Failed to receive message from LLM", error);
      return null;
    }
  }
}
