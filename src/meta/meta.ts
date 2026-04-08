import { spawn } from "bun";
import { Logger } from "../logger/logger";

// This is sort of like a utils directory
export namespace Metadata {
  export const FPS = 16;
  export const TIMEOUT = 60;
  export const CLIP_DURATION = 5;
  export const TRANSITION_DURATION = 3;
  export const clientId = Bun.randomUUIDv7();

  export function randomId() {
    return Bun.randomUUIDv7();
  }

  // TODO Can probably delete this
  export function derive_video_structure(duration: number) {
    const { CLIP_DURATION, TRANSITION_DURATION } = Metadata;

    // Base equation: duration = (Metadata.CLIP_DURATION * x) + (Metadata.TRANSITION_DURATION * (x - 1))
    const clipCount = Math.ceil(
      (duration + TRANSITION_DURATION) / (CLIP_DURATION + TRANSITION_DURATION),
    );

    const transitionCount = clipCount - 1;

    return {
      audioDuration: duration,
      totalDuration:
        clipCount * CLIP_DURATION + transitionCount * TRANSITION_DURATION,
      clipCount,
      transitionCount,
    };
  }

  export async function getAudioDuration(blob: Blob) {
    const tempFile = `/tmp/audio-${Date.now()}.mp3`;
    await Bun.write(tempFile, await blob.arrayBuffer());

    try {
      const ffprobeProcess = spawn([
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        tempFile,
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
        return parseInt(json.format.duration);
      } catch (error) {
        Logger.error("Failed to parse audio metadata", { error });
        throw new Error("Failed to parse audio metadata");
      }
    } finally {
      await Bun.file(tempFile).delete();
    }
  }
}
