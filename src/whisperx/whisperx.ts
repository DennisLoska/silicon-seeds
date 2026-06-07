import { Utils } from "../utils/utils";
import { basename, extname, join } from "node:path";
import { spawn } from "bun";
import { mkdir } from "node:fs/promises";

export namespace WhisperX {
  export async function run(inputPath: string, outputPath?: string) {
    const whisperBinary = Bun.env.WHISPER_X;
    const baseOutputDir = outputPath ?? "/tmp";
    const output = join(baseOutputDir, "whisperx");

    await mkdir(output, { recursive: true });

    if (!whisperBinary) {
      throw new Error("WHISPER_X environment variable is not configured");
    }

    const process = spawn({
      cmd: [
        whisperBinary,
        inputPath,
        "--output_dir",
        output,
        "--output_format",
        "json",
      ],
      cwd: output,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const { stdout, stderr, exitCode } =
      await Utils.collectProcessOutput(process);
    if (exitCode !== 0) {
      throw new Error(`WhisperX failed: ${(stderr || stdout).trim()}`);
    }

    const outputJsonPath = join(
      output,
      `${basename(inputPath, extname(inputPath))}.json`,
    );

    const file = Bun.file(outputJsonPath);
    if (!(await file.exists())) {
      throw new Error(
        `WhisperX did not write expected JSON output to ${outputJsonPath}`,
      );
    }

    return outputJsonPath;
  }
}
