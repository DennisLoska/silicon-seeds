import { Client, StdioClientTransport } from "@modelcontextprotocol/client";
import { Logger } from "../logger/logger";

export namespace MCPVideo {
  let client: Client | null = null;
  let ready = false;

  export async function init() {
    if (ready) return;

    try {
      const transport = new StdioClientTransport({
        command: "uvx",
        args: ["--from", "mcp-video", "mcp-video"],
      });

      client = new Client({ name: "silicon-seeds-mcp-video", version: "0.1.0" });
      await client.connect(transport);

      Logger.info("MCP-video connected");
      ready = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.error("Failed to connect MCP-video", { message });
      ready = false;
    }
  }

  export function isReady() {
    return ready && client !== null;
  }

  export async function callTool(name: string, args: Record<string, unknown>) {
    if (!client || !ready) {
      throw new Error("MCP-video not initialized");
    }

    const response = await client.callTool({ name, arguments: args });
    return response;
  }

  export async function listTools() {
    if (!client || !ready) return [];
    const { tools } = await client.listTools();
    return tools;
  }

  export async function hyperframesInit(projectPath: string) {
    return callTool("hyperframes_init", { project_path: projectPath });
  }

  export async function hyperframesRender(
    projectPath: string,
    outputPath: string,
  ) {
    return callTool("hyperframes_render", {
      project_path: projectPath,
      output_path: outputPath,
    });
  }
}
