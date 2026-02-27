import { LMStudioClient } from "@lmstudio/sdk";

const client = new LMStudioClient();
const llm = await client.llm.model("qwen/qwen3-vl-30b");

export namespace LLM {
  export async function message(msg: string) {
    return await llm.respond(msg);
  }
}
