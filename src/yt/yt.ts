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

  /**
   * Extract metadata for all videos in a URL (single video or playlist)
   * without downloading anything. Returns one JSON object per line (NDJSON).
   */
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

  /**
   * Download audio from a single video URL and return the path to the MP3 file.
   */
  export async function downloadAudio(
    videoUrl: string,
    outputDir: string,
    titleSanitized: string,
  ): Promise<string> {
    await mkdir(outputDir, { recursive: true });

    const audioPathTemplate = join(outputDir, `${titleSanitized}.%(ext)s`);

    Utils.assert(YT_DLP, "YT_DLP environment variable is not configured");
    const process = spawn({
      cmd: [
        YT_DLP,
        "--format",
        "bestaudio/best",
        "--output",
        audioPathTemplate,
        "--extractor-args",
        'youtube:player_client=["web"]',
        "--no-warnings",
        "--quiet",
        videoUrl,
      ],
      cwd: outputDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const { stdout, stderr, exitCode } =
      await Utils.collectProcessOutput(process);
    if (exitCode !== 0) {
      throw new Error(`yt-dlp download failed: ${(stderr || stdout).trim()}`);
    }

    // Find the actual MP3 file that was written
    const entries = await readdir(outputDir);
    for (const entry of entries) {
      if (entry.startsWith(titleSanitized) && entry.endsWith(".mp3")) {
        return join(outputDir, entry);
      }
    }

    throw new Error(
      `yt-dlp did not produce expected MP3 in ${outputDir} for title "${titleSanitized}"`,
    );
  }

  /**
   * Download audio from a single video URL with cookies support.
   */
  export async function downloadAudioWithCookies(
    videoUrl: string,
    outputDir: string,
    titleSanitized: string,
    cookieFile: string,
  ): Promise<string> {
    await mkdir(outputDir, { recursive: true });

    const audioPathTemplate = join(outputDir, `${titleSanitized}.%(ext)s`);

    Utils.assert(YT_DLP, "YT_DLP environment variable is not configured");
    const process = spawn({
      cmd: [
        YT_DLP,
        "--format",
        "bestaudio/best",
        "--output",
        audioPathTemplate,
        "--cookies",
        cookieFile,
        "--extractor-args",
        'youtube:player_client=["web"]',
        "--no-warnings",
        "--quiet",
        videoUrl,
      ],
      cwd: outputDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const { stdout, stderr, exitCode } =
      await Utils.collectProcessOutput(process);
    if (exitCode !== 0) {
      throw new Error(`yt-dlp download failed: ${(stderr || stdout).trim()}`);
    }

    // Find the actual MP3 file that was written
    const entries = await readdir(outputDir);
    for (const entry of entries) {
      if (entry.startsWith(titleSanitized) && entry.endsWith(".mp3")) {
        return join(outputDir, entry);
      }
    }

    throw new Error(
      `yt-dlp did not produce expected MP3 in ${outputDir} for title "${titleSanitized}"`,
    );
  }

  /**
   * Download a full MP4 video from a single video URL and return the path.
   */
  export async function downloadVideo(
    videoUrl: string,
    outputDir: string,
    titleSanitized: string,
  ): Promise<string> {
    await mkdir(outputDir, { recursive: true });

    const videoPathTemplate = join(outputDir, `${titleSanitized}.%(ext)s`);

    Utils.assert(YT_DLP, "YT_DLP environment variable is not configured");
    const process = spawn({
      cmd: [
        YT_DLP,
        "--format",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format",
        "mp4",
        "--output",
        videoPathTemplate,
        "--extractor-args",
        'youtube:player_client=["web"]',
        "--no-warnings",
        "--quiet",
        videoUrl,
      ],
      cwd: outputDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const { stdout, stderr, exitCode } =
      await Utils.collectProcessOutput(process);
    if (exitCode !== 0) {
      throw new Error(`yt-dlp download failed: ${(stderr || stdout).trim()}`);
    }

    // Find the actual MP4 file that was written
    const entries = await readdir(outputDir);
    for (const entry of entries) {
      if (entry.startsWith(titleSanitized) && entry.endsWith(".mp4")) {
        return join(outputDir, entry);
      }
    }

    throw new Error(
      `yt-dlp did not produce expected MP4 in ${outputDir} for title "${titleSanitized}"`,
    );
  }

  /**
   * Download a full MP4 video from a single video URL with cookies support.
   */
  export async function downloadVideoWithCookies(
    videoUrl: string,
    outputDir: string,
    titleSanitized: string,
    cookieFile: string,
  ): Promise<string> {
    await mkdir(outputDir, { recursive: true });

    const videoPathTemplate = join(outputDir, `${titleSanitized}.%(ext)s`);

    Utils.assert(YT_DLP, "YT_DLP environment variable is not configured");
    const process = spawn({
      cmd: [
        YT_DLP,
        "--format",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format",
        "mp4",
        "--output",
        videoPathTemplate,
        "--cookies",
        cookieFile,
        "--extractor-args",
        'youtube:player_client=["web"]',
        "--no-warnings",
        "--quiet",
        videoUrl,
      ],
      cwd: outputDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const { stdout, stderr, exitCode } =
      await Utils.collectProcessOutput(process);
    if (exitCode !== 0) {
      throw new Error(`yt-dlp download failed: ${(stderr || stdout).trim()}`);
    }

    // Find the actual MP4 file that was written
    const entries = await readdir(outputDir);
    for (const entry of entries) {
      if (entry.startsWith(titleSanitized) && entry.endsWith(".mp4")) {
        return join(outputDir, entry);
      }
    }

    throw new Error(
      `yt-dlp did not produce expected MP4 in ${outputDir} for title "${titleSanitized}"`,
    );
  }

  /**
   * Sanitize a video or channel title to create a safe directory/file name.
   */
  export function sanitizeTitle(title: string): string {
    return title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .toLowerCase();
  }
}
