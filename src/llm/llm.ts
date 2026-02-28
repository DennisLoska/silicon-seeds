import { LMStudioClient } from "@lmstudio/sdk";

const llmClient = new LMStudioClient();
const llm = await llmClient.llm.model("qwen/qwen3-vl-30b");

export namespace LLM {
  export const client = llmClient;

  export async function message(msg: string, opt = {}) {
    return await llm.respond(msg, opt);
  }
}
