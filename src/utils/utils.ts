import nodeAssert from "node:assert";
import { spawn } from "bun";

const IS_PRODUCTION = Bun.env.NODE_ENV === "production";

export namespace Utils {
  export function assert(value: unknown, message: string): asserts value {
    if (IS_PRODUCTION) return;
    nodeAssert(value, message);
  }

  export function getContentType(path: string): string {
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
    if (path.endsWith(".webp")) return "image/webp";
    if (path.endsWith(".mp4")) return "video/mp4";
    if (path.endsWith(".webm")) return "video/webm";
    if (path.endsWith(".mp3")) return "audio/mpeg";
    if (path.endsWith(".wav")) return "audio/wav";
    if (path.endsWith(".json")) return "application/json";
    return "application/octet-stream";
  }

  export function sanitizeInputText(text: string): string {
    return text
      .replace(/\u0000/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .trim();
  }

  export async function collectProcessOutput(
    process: ReturnType<typeof spawn>,
  ) {
    const decoder = new TextDecoder();
    let stdout = "";
    let stderr = "";

    if (process.stdout && typeof process.stdout !== "number") {
      for await (const chunk of process.stdout) {
        stdout += typeof chunk === "string" ? chunk : decoder.decode(chunk);
      }
    }

    if (process.stderr && typeof process.stderr !== "number") {
      for await (const chunk of process.stderr) {
        stderr += typeof chunk === "string" ? chunk : decoder.decode(chunk);
      }
    }

    const exitCode = await process.exited;
    return { stdout, stderr, exitCode };
  }
}
