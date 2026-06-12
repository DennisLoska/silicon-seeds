import { Utils } from "../utils/utils";
import { join } from "node:path";
import { spawn } from "bun";
import { mkdir, readdir } from "node:fs/promises";

export namespace YtDlp {
  const YT_DLP = Bun.env.YT_DLP;
  Utils.assert(YT_DLP, "YT_DLP environment variable is not configured");

  export interface VideoInfo {
    id: string;
    title: string;
    channel?: string;
    uploader?: string;
    duration?: number;
    original_url?: string;
    [key: string]: unknown;
  }

  export async function list(url: string): Promise<VideoInfo[]> {
    Utils.assert(YT_DLP, "YT_DLP environment variable is not configured");
    const process = spawn({
      cmd: [YT_DLP, "--flat-playlist", "--skip-download", "-j", url],
      stdio: ["ignore", "pipe", "pipe"],
    });

    const { stdout, stderr, exitCode } =
      await Utils.collectProcessOutput(process);
    if (exitCode !== 0) {
      throw new Error(`yt-dlp list failed: ${(stderr || stdout).trim()}`);
    }

    const lines = stdout
      .trim()
      .split("\n")
      .filter((l) => l.length > 0);
    return lines.map((line) => JSON.parse(line) as VideoInfo);
  }

  type DownloadFormat = "audio" | "video";

  const FORMAT_CONFIG: Record<DownloadFormat, { format: string; ext: string; merge?: string }> = {
    audio: { format: "bestaudio/best", ext: ".mp3" },
    video: { format: "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best", ext: ".mp4", merge: "mp4" },
  };

  async function downloadBase(
    videoUrl: string,
    outputDir: string,
    titleSanitized: string,
    type: DownloadFormat,
    cookieFile?: string,
  ): Promise<string> {
    await mkdir(outputDir, { recursive: true });

    const cfg = FORMAT_CONFIG[type];
    const pathTemplate = join(outputDir, `${titleSanitized}.%(ext)s`);

    Utils.assert(YT_DLP, "YT_DLP environment variable is not configured");
    const cmd = [
      YT_DLP,
      "--format",
      cfg.format,
      ...(cfg.merge ? ["--merge-output-format", cfg.merge] : []),
      "--output",
      pathTemplate,
      ...(cookieFile ? ["--cookies", cookieFile] : []),
      "--extractor-args",
      'youtube:player_client=["web"]',
      "--no-warnings",
      "--quiet",
      videoUrl,
    ];

    const process = spawn({ cmd, cwd: outputDir, stdio: ["ignore", "pipe", "pipe"] });

    const { stdout, stderr, exitCode } =
      await Utils.collectProcessOutput(process);
    if (exitCode !== 0) {
      throw new Error(`yt-dlp download failed: ${(stderr || stdout).trim()}`);
    }

    const entries = await readdir(outputDir);
    for (const entry of entries) {
      if (entry.startsWith(titleSanitized) && entry.endsWith(cfg.ext)) {
        return join(outputDir, entry);
      }
    }

    throw new Error(
      `yt-dlp did not produce expected ${cfg.ext} in ${outputDir} for title "${titleSanitized}"`,
    );
  }

  export async function downloadAudio(
    videoUrl: string,
    outputDir: string,
    titleSanitized: string,
  ): Promise<string> {
    return downloadBase(videoUrl, outputDir, titleSanitized, "audio");
  }

  export async function downloadAudioWithCookies(
    videoUrl: string,
    outputDir: string,
    titleSanitized: string,
    cookieFile: string,
  ): Promise<string> {
    return downloadBase(videoUrl, outputDir, titleSanitized, "audio", cookieFile);
  }

  export async function downloadVideo(
    videoUrl: string,
    outputDir: string,
    titleSanitized: string,
  ): Promise<string> {
    return downloadBase(videoUrl, outputDir, titleSanitized, "video");
  }

  export async function downloadVideoWithCookies(
    videoUrl: string,
    outputDir: string,
    titleSanitized: string,
    cookieFile: string,
  ): Promise<string> {
    return downloadBase(videoUrl, outputDir, titleSanitized, "video", cookieFile);
  }

  export function sanitizeTitle(title: string): string {
    return title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();
  }
}
