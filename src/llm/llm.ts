import { FileHandle, LMStudioClient } from "@lmstudio/sdk";
import { Logger } from "../logger/logger";
import z from "zod/v3";
import { Utils } from "../utils/utils";

const llmClient = new LMStudioClient();
const LLM_MODEL = Bun.env.LLM_MODEL;
Utils.assert(LLM_MODEL, "LLM_MODEL variable missing");

let llmModel: Awaited<ReturnType<typeof llmClient.llm.model>> | null = null;
try {
  if (LLM_MODEL) llmModel = await llmClient.llm.model(LLM_MODEL);
} catch {
  // LMStudio not available in CI/test - allow server to start for E2E happy paths
}

const EMBEDDING_MODEL = Bun.env.EMBEDDING_MODEL;
Utils.assert(EMBEDDING_MODEL, "EMBEDDING_MODEL variable missing");
let embeddingModel: Awaited<ReturnType<typeof llmClient.embedding.model>> | null = null;
try {
  if (EMBEDDING_MODEL) embeddingModel = await llmClient.embedding.model(EMBEDDING_MODEL);
} catch {
  // LMStudio not available in CI/test - allow server to start for E2E happy paths
}

export namespace LLM {
  export const client = llmClient;
  const MAX_TOKENS = 10_000;

  export async function message(msg: string, images?: FileHandle[]) {
    if (!llmModel) {
      Logger.warn("LLM model not loaded, skipping message");
      return null;
    }
    try {
      if (images) {
        return await llmModel.respond(
          { role: "user", content: msg, images },
          { maxTokens: MAX_TOKENS },
        );
      }

      return await llmModel.respond(
        { role: "user", content: msg },
        { maxTokens: MAX_TOKENS },
      );
    } catch (error) {
      Logger.error("Failed to receive message from LLM", error);
      return null;
    }
  }

  export async function image_prompt_list(msg: string, amount: number) {
    if (!llmModel) {
      Logger.warn("LLM model not loaded, skipping image_prompt_list");
      return null;
    }
    const mapSchema: Record<string, z.ZodString> = {};
    for (let i = 0; i < amount; i++) {
      if (!mapSchema[i]) mapSchema[i] = z.string();
    }

    try {
      // Why TypeScript :(
      const typedSchema = z.object(mapSchema);

      return await llmModel.respond(msg, {
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
    if (!llmModel) {
      Logger.warn("LLM model not loaded, skipping structured");
      return null;
    }
    try {
      return (await llmModel.respond(msg, {
        structured: schema,
        maxTokens: MAX_TOKENS,
      })) as unknown as { parsed: z.infer<T> } | null;
    } catch (error) {
      Logger.error("Failed to receive structured message from LLM", error);
      return null;
    }
  }

  export async function generateEmbedding(text: string): Promise<number[]> {
    if (!embeddingModel) {
      Logger.warn("Embedding model not loaded, returning empty embedding");
      return [];
    }
    const result = await embeddingModel.embed(text);
    return result.embedding;
  }
}
