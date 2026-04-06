import nodeAssert from "node:assert";

export namespace Utils {
  export function assert(value: unknown, message: string): asserts value {
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
}
