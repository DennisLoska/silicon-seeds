import { spawn } from "bun";

export namespace Metadata {
  export const clientId = Bun.randomUUIDv7();

  export function randomId() {
    return Bun.randomUUIDv7();
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
        output += decoder.decode(chunk, { stream: true });
      }

      const status = await ffprobeProcess.exited;

      if (status !== 0) {
        throw new Error("ffprobe failed to execute");
      }

      try {
        const json = JSON.parse(output);
        return parseInt(json.format.duration);
      } catch (e) {
        throw new Error("Failed to parse audio metadata");
      }
    } finally {
      await Bun.file(tempFile).delete();
    }
  }
}
