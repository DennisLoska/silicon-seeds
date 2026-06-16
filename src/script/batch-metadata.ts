import z from "zod/v3";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { LLM } from "../llm/llm";
import { Logger } from "../logger/logger";

const FALLBACK_OUTPUT = "/run/media/dennis/ai/comfy-ui/output";

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function isImage(name: string): boolean {
  const i = name.lastIndexOf(".");
  return i > 0 && IMAGE_EXTS.has(name.slice(i).toLowerCase());
}

function resCat(w: number, h: number): string {
  const m = Math.min(w, h);
  if (m <= 240) return "240p";
  if (m <= 360) return "360p";
  if (m <= 480) return "480p";
  if (m <= 720) return "720p";
  if (m <= 1080) return "1080p";
  if (m <= 1440) return "1440p";
  return m <= 2160 ? "4k" : "8k";
}

async function getRes(fp: string): Promise<string | null> {
  try {
    const p = Bun.spawn(["file", fp]);
    const t = await new Response(p.stdout).text();
    const m = t.match(/(\d+)\s*x\s*(\d+)/);
    return m ? resCat(+m[1], +m[2]) : null;
  } catch {
    return null;
  }
}

async function getCreated(fp: string): Promise<string> {
  try {
    const s = await Bun.file(fp).stat();
    return s.birthtime?.toISOString() ?? new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

let _processed = 0;
let _total = 0;

async function genMetadata(fp: string): Promise<void> {
  const fn = fp.split("/").pop()!;
  const stem = fn.split(".")[0];
  const contentDir = Bun.env.CONTENT_LIBRARY_DIR;
  if (!contentDir) {
    Logger.warn("CONTENT_LIBRARY_DIR not set — skipping metadata save");
    return;
  }

  const imgDir = join(contentDir, "image");
  const out = join(imgDir, `.${stem}.metadata.json`);

  const idx = ++_processed;

  if (await Bun.file(out).exists()) {
    Logger.info(`→ [${idx}/${_total}] ${fn} (skip)`);
    return;
  }

  Logger.info(`→ [${idx}/${_total}] ${fn}`);

  const buf = await Bun.file(fp).arrayBuffer();
  const b64 = Buffer.from(buf).toString("base64");
  const h = await LLM.client.files.prepareImageBase64(fn, b64);

  const msg = await LLM.message("Describe this image in detail.", [h]);
  if (!msg?.content) {
    Logger.warn(`No description returned for ${fn}`);
    return;
  }

  const [t, tg] = await Promise.all([
    LLM.message(`Short title (5–10 words) for: ${msg.content}`),
    LLM.structured(`Tags (3–5) for: ${msg.content}`, z.array(z.string()).min(1).max(5)),
  ]);

  const meta = {
    job_id: Bun.randomUUIDv7(),
    created_at: await getCreated(fp),
    filename: fn,
    filetype: "image",
    resolution: await getRes(fp),
    title: t?.content ?? null,
    description: msg.content,
    tags: tg?.parsed ?? [],
    prompt: null,
    model: null,
    style: null,
  };

  // Write image first, then metadata — if crash mid-batch, metadata absence
  // ensures re-run reprocesses rather than leaving orphan metadata.
  await Bun.write(join(imgDir, fn), buf);
  await Bun.write(out, JSON.stringify(meta, null, 2));
  Logger.info(`✓ [${_processed}/${_total}] .${stem}.metadata.json + ${fn}`);
}

async function main() {
  await Logger.init();

  const dir = Bun.env.OUTPUT_DIR ?? FALLBACK_OUTPUT;
  const contentDir = Bun.env.CONTENT_LIBRARY_DIR;
  if (!contentDir) {
    Logger.error("CONTENT_LIBRARY_DIR not set — run from silicon-seeds/ or set env");
    process.exit(1);
  }

  // Ensure the image subdirectory exists
  const imgDir = join(contentDir, "image");
  await Bun.$`mkdir -p ${imgDir}`.nothrow();

  const files = (await readdir(dir)).filter(isImage).sort();

  if (!files.length) {
    Logger.info("No images found");
    return;
  }

  _total = files.length;
  const BATCH_SIZE = 5;
  Logger.info(`${files.length} images → ${imgDir}, batch ${BATCH_SIZE}`);

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((f) => genMetadata(join(dir, f))));
  }

  Logger.info("Done");
}

if (import.meta.main) {
  main();
}
