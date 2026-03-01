import { FileHandle, LMStudioClient } from "@lmstudio/sdk";

const llmClient = new LMStudioClient();
let llm = await llmClient.llm.model("qwen/qwen3-vl-30b");

export namespace LLM {
  export const client = llmClient;

  // TODO use the system prompt
  const system = `You are a prompt engineer expert. Your only task is to create either high quality image prompts
or high quality video prompts based on the user's request - nothing more!
If the user provides you an actual image he wants you to create a prompt for a video so you should take the scene
information from the image and use it to come up with a nice video prompt to make the image come to life similar
to animated wallpapers.

Your response should only contain the actual prompt and nothing more!

I believe in you! You can do this!
`;

  export async function message(msg: string, images?: FileHandle[]) {
    if (images) {
      return await llm.respond({ role: "user", content: msg, images });
    }

    return await llm.respond({ role: "user", content: msg });
  }
}
