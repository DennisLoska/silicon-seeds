import { spawn } from "bun";
import { Logger } from "../logger/logger";

// This is sort of like a utils directory
export namespace Metadata {
  // TODO delete these
  export const FPS = 16;
  export const CLIP_DURATION = 5;
  export const TRANSITION_DURATION = 3;

  export const TIMEOUT = 60;
  export const clientId = Bun.randomUUIDv7();

  export function randomId() {
    return Bun.randomUUIDv7();
  }

  export async function getMediaDurationFromPath(filePath: string) {
    const ffprobeProcess = spawn([
      "ffprobe",
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      filePath,
    ]);

    const decoder = new TextDecoder();
    let output = "";
    for await (const chunk of ffprobeProcess.stdout) {
      if (typeof chunk === "string") {
        output += chunk;
      } else {
        output += decoder.decode(chunk);
      }
    }

    const status = await ffprobeProcess.exited;

    if (status !== 0) {
      throw new Error("Failed to execute 'ffprobe'");
    }

    try {
      const json = JSON.parse(output);
      const duration = Number(json.format.duration);

      if (!Number.isFinite(duration) || duration <= 0) {
        throw new Error("Invalid media duration");
      }

      return duration;
    } catch (error) {
      Logger.error("Failed to parse audio metadata", { error });
      throw new Error("Failed to parse audio metadata");
    }
  }

  export async function getAudioDuration(blob: Blob) {
    const tempFile = `/tmp/audio-${Date.now()}.mp3`;
    await Bun.write(tempFile, await blob.arrayBuffer());

    try {
      const duration = await getMediaDurationFromPath(tempFile);
      return Math.max(1, Math.ceil(duration));
    } finally {
      await Bun.file(tempFile).delete();
    }
  }
}
