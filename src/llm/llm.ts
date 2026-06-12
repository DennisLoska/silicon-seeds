import { ChatLike, FileHandle, LMStudioClient, tool } from "@lmstudio/sdk";
import { Logger } from "../logger/logger";
import z from "zod/v3";
import { Utils } from "../utils/utils";

const llmClient = new LMStudioClient();
const LLM_MODEL = Bun.env.LLM_MODEL;
Utils.assert(LLM_MODEL, "LLM_MODEL variable missing");

const llm = await llmClient.llm.model(LLM_MODEL);
import { Client, StdioClientTransport } from "@modelcontextprotocol/client";
import { Metadata } from "../meta/meta";

const mcpClient = new Client({ name: "mcp-client", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: "bun",
  args: ["run", "mcp-searxng"],
  env: {
    ...process.env,
    // MCP_RATE_INIT_MAX: "1000",
    // MCP_RATE_SESSION_MAX: "5000",
    // MCP_RATE_WINDOW_MS: "1000",
    SERVER_URL: "http://localhost:8888",
    SEARXNG_URL: "http://localhost:8888",
    X_REAL_IP: "127.0.0.1",
    X_FORWARDED_FOR: "127.0.0.1",
    USER_AGENT:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
});

await mcpClient.connect(transport);

const { tools: mcpTools } = await mcpClient.listTools();
const runnableTools = mcpTools.map((mcpTool) => {
  return tool({
    name: mcpTool.name,
    description: mcpTool.description ?? "Perform a live action via MCP",
    // Pass the raw JSON input schema parameters directly
    parameters: {
      query: z.string().describe("The primary search query string."),

      categories: z
        .array(z.string())
        .describe(
          "CRITICAL: Must be an array of strings. Example: ['videos'] or ['general']. Never pass a single string.",
        ),

      time_range: z.string().optional().default("month"),
    },
    // The implementation method is triggered automatically by .act()
    implementation: async (args: any) => {
      Logger.info(`[LM Studio Engine triggered tool call]: ${mcpTool.name}`);
      if (mcpTool.name === "searxng_web_search") {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      try {
        const response = await mcpClient.callTool({
          name: mcpTool.name,
          arguments: args,
        });

        // Return string text output back into the underlying active model context
        const textContent = response.content
          .map((item: any) => item.text ?? "")
          .join("\n");

        return textContent;
      } catch (error) {
        Logger.error("error", error);
        return `Error calling tool ${mcpTool.name}: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });
});

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

  export async function web_search(query: string): Promise<string | null> {
    const conversationContext: ChatLike = [
      {
        role: "system",
        content:
          "You are an AI research assistant. Be concise. Only call the 'search' tool if absolutely necessary. If a web search returns an empty result, DO NOT loop or repeat the search over and over; assume the service is rate-limited and immediately work with the data you already have.",
      },
      {
        role: "user",
        content: query,
      },
    ];

    let result = "";

    await llm.act(conversationContext, runnableTools, {
      maxTokens: Metadata.MAX_TOKENS,
      // Optional streaming callback to monitor internal thoughts and messages
      onMessage: (message) => {
        result = message.toString();
      },
    });

    return result;
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
