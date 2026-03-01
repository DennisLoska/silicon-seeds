import { LMStudioClient } from "@lmstudio/sdk";

const llmClient = new LMStudioClient();
let llm = await llmClient.llm.model("qwen/qwen3-vl-30b");

export namespace LLM {
  export const client = llmClient;

  export async function load_model() {
    llm = await llmClient.llm.model("qwen/qwen3-vl-30b");
  }

  export async function message(msg: string, opt = {}) {
    await load_model();
    return await llm.respond(msg, opt);
  }
}
