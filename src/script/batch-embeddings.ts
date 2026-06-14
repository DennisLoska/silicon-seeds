import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { Chroma } from "../chroma/chroma";
import { Logger } from "../logger/logger";

const FILETYPE_DIRS = ["image", "video", "text"];

async function dirExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function findMetadataFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(path: string) {
    const entries = await readdir(path, { withFileTypes: true });
    for (const e of entries) {
      const full = join(path, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.name.endsWith(".metadata.json") && e.name.startsWith(".")) {
        results.push(full);
      }
    }
  }

  await walk(dir);
  return results;
}

async function main() {
  await Logger.init();

  const contentDir = Bun.env.CONTENT_LIBRARY_DIR;
  if (!contentDir) {
    Logger.error("CONTENT_LIBRARY_DIR not set");
    process.exit(1);
  }

  let allFiles: string[] = [];

  for (const ft of FILETYPE_DIRS) {
    const ftDir = join(contentDir, ft);
    const exists = await dirExists(ftDir);
    if (!exists) {
      Logger.info(`Skipping ${ftDir} — not found`);
      continue;
    }
    const files = await findMetadataFiles(ftDir);
    allFiles.push(...files);
    Logger.info(`Found ${files.length} metadata files in ${ft}`);
  }

  if (!allFiles.length) {
    Logger.info("No metadata files found");
    return;
  }

  const BATCH_SIZE = 5;
  Logger.info(`${allFiles.length} metadata files, batch ${BATCH_SIZE}`);

  for (let i = 0; i < allFiles.length; i += BATCH_SIZE) {
    const batch = allFiles.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (fp) => {
        const rel = relative(contentDir, fp);
        try {
          const raw = await Bun.file(fp).json();
          const stem = raw.filename?.split(".")[0] ?? fp.split("/").pop()!.split(".")[0].replace(/^\./, "");

          await Chroma.saveEmbedding({
            id: raw.id ?? stem,
            title: raw.title ?? "",
            description: raw.description ?? "",
            tags: raw.tags ?? [],
            prompt: raw.prompt ?? "",
            filename: raw.filename ?? stem,
            filetype: raw.filetype ?? "unknown",
            resolution: raw.resolution ?? "",
            style: raw.style ?? "",
          });

          Logger.info(`✓ ${rel}`);
        } catch (err) {
          Logger.error(`✗ ${rel}`, { error: err instanceof Error ? err.message : String(err) });
        }
      }),
    );
  }

  Logger.info("Done");
}

if (import.meta.main) {
  main();
}
