import { Logger } from "../logger/logger";

interface PreviewProcess {
  jobId: string;
  port: number;
  process: () => void;
  kill: () => void;
}

const PREVIEWS = new Map<string, PreviewProcess>();

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = Bun.listen({
      port: 0,
      hostname: "127.0.0.1",
      socket: {
        open() {},
        data() {},
        close() {},
        error() {},
      },
    });
    const port = server.port;
    server.stop();
    resolve(port);
  });
}

export namespace HypercutPreviewManager {
  let cleanupRegistered = false;

  function registerGlobalCleanup() {
    if (cleanupRegistered) return;
    cleanupRegistered = true;
    process.on("SIGINT", () => {
      for (const [id, p] of PREVIEWS) {
        Logger.info("HypercutPreview: killing preview for job", { jobId: id });
        p.kill();
      }
      PREVIEWS.clear();
    });
  }

  export async function start(jobId: string, projectDir: string): Promise<number> {
    const existing = PREVIEWS.get(jobId);
    if (existing) {
      Logger.info("HypercutPreview: reusing existing preview", { jobId, port: existing.port });
      return existing.port;
    }

    const port = await findFreePort();

    const proc = Bun.spawn(["npx", "--yes", "hyperframes", "preview", projectDir, "--port", String(port), "--no-open"], {
      cwd: projectDir,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const preview: PreviewProcess = {
      jobId,
      port,
      process: () => {},
      kill: () => {
        proc.kill(9);
      },
    };

    PREVIEWS.set(jobId, preview);
    registerGlobalCleanup();

    // Wait for server to be ready
    const startTime = Date.now();
    while (Date.now() - startTime < 15000) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/`);
        if (res.ok) {
          Logger.info("HypercutPreview: preview server ready", { jobId, port });
          return port;
        }
      } catch {}
      await Bun.sleep(500);
    }

    Logger.error("HypercutPreview: preview server failed to start", { jobId });
    preview.kill();
    PREVIEWS.delete(jobId);
    throw new Error("Preview server failed to start");
  }

  export function stop(jobId: string) {
    const preview = PREVIEWS.get(jobId);
    if (preview) {
      preview.kill();
      PREVIEWS.delete(jobId);
      Logger.info("HypercutPreview: stopped preview", { jobId });
    }
  }

  export function stopAll() {
    for (const [id, p] of PREVIEWS) {
      p.kill();
    }
    PREVIEWS.clear();
  }
}
