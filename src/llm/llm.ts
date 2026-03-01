import { FileHandle, LMStudioClient } from "@lmstudio/sdk";

const llmClient = new LMStudioClient();
let llm = await llmClient.llm.model("qwen/qwen3-vl-30b");

export namespace LLM {
  export const client = llmClient;

  export async function message(msg: string, images?: FileHandle[]) {
    if (images) {
      return await llm.respond({ role: "user", content: msg, images });
    }

    return await llm.respond({ role: "user", content: msg });
  }
}
