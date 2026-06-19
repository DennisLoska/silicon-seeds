import { join } from "node:path";
import { statSync } from "node:fs";
import { HyperCutWorkflow } from "./hypercut-workflow";
import { HypercutPreviewManager } from "./preview-manager";
import {
  lintCompositionHtml,
  type CompositionValidationFinding,
} from "./composition-validator";

export interface RenderDiagnostics {
  workDir: string | null;
  compiledHtmlExists: boolean;
  compiledHtmlBytes: number;
  capturedFramesCount: number;
  outputExists: boolean;
  outputBytes: number;
}

export class RenderValidationError extends Error {
  readonly findings: CompositionValidationFinding[];
  constructor(findings: CompositionValidationFinding[]) {
    const messages = findings.map(f => `[${f.severity}] ${f.code}: ${f.message}`);
    super(`Composition validation failed:\n${messages.join("\n")}`);
    this.name = "RenderValidationError";
    this.findings = findings;
  }
}

export class RenderOutputError extends Error {
  readonly diagnostics: RenderDiagnostics;
  constructor(message: string, diagnostics: RenderDiagnostics) {
    super(message);
    this.name = "RenderOutputError";
    this.diagnostics = diagnostics;
  }
}

const MIN_OUTPUT_BYTES = 1024;

export async function describeRenderDiagnostics(
  outputDir: string,
  projectDir: string,
): Promise<RenderDiagnostics> {
  const empty: RenderDiagnostics = {
    workDir: null,
    compiledHtmlExists: false,
    compiledHtmlBytes: 0,
    capturedFramesCount: 0,
    outputExists: false,
    outputBytes: 0,
  };

  const searchDirs = [
    join(projectDir, "renders"),
    outputDir,
  ];

  let workDir: string | null = null;
  let newestMtime = 0;

  for (const searchDir of searchDirs) {
    try {
      const entries: string[] = [];
      for await (const name of new Bun.Glob("work-*").scan({ cwd: searchDir, onlyFiles: false })) {
        entries.push(name);
      }
      for (const name of entries) {
        const fullPath = join(searchDir, name);
        try {
          const stat = statSync(fullPath);
          if (stat && stat.mtimeMs > newestMtime) {
            newestMtime = stat.mtimeMs;
            workDir = fullPath;
          }
        } catch {}
      }
    } catch {}
  }

  if (!workDir) return empty;

  const compiledPath = join(workDir, "compiled", "index.html");
  const compiledFile = Bun.file(compiledPath);
  let compiledHtmlExists = false;
  let compiledHtmlBytes = 0;
  try {
    compiledHtmlExists = await compiledFile.exists();
    if (compiledHtmlExists) {
      const stat = await compiledFile.stat();
      compiledHtmlBytes = stat?.size ?? 0;
    }
  } catch {}

  let capturedFramesCount = 0;
  try {
    const frames: string[] = [];
    for await (const f of new Bun.Glob("frame_*.jpg").scan({ cwd: join(workDir, "captured-frames") })) {
      frames.push(f);
    }
    capturedFramesCount = frames.length;
  } catch {}

  return {
    workDir,
    compiledHtmlExists,
    compiledHtmlBytes,
    capturedFramesCount,
    outputExists: false,
    outputBytes: 0,
  };
}

export async function renderWithValidation(
  jobId: string,
  outputDir: string,
): Promise<string> {
  const projectDir = join(outputDir, `hypercut-${jobId}`);
  const compPath = join(projectDir, "index.html");

  await HypercutPreviewManager.syncFromStudio(jobId, projectDir);

  const compFile = Bun.file(compPath);
  if (!(await compFile.exists())) {
    throw new RenderValidationError([{
      code: "missing_file",
      severity: "error",
      message: `Composition file not found: ${compPath}. Generate the composition before rendering.`,
    }]);
  }
  const html = await compFile.text();
  if (html.trim().length === 0) {
    throw new RenderValidationError([{
      code: "empty_file",
      severity: "error",
      message: `Composition file is empty: ${compPath}`,
    }]);
  }

  const validation = await lintCompositionHtml(html);
  if (validation.errorCount > 0) {
    throw new RenderValidationError(validation.findings.filter(f => f.severity === "error"));
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let outputPath: string;
    try {
      outputPath = await HyperCutWorkflow.render(jobId, outputDir);
    } catch (renderError) {
      lastError = renderError instanceof Error ? renderError : new Error(String(renderError));
      if (attempt < 1) {
        continue;
      }
      const diag = await describeRenderDiagnostics(outputDir, projectDir);
      const reason = describeFailureReason(diag);
      throw new RenderOutputError(
        `Render stage failed: ${lastError.message}. ${reason}`,
        diag,
      );
    }

    const outputFile = Bun.file(outputPath);
    let outputExists = false;
    let outputBytes = 0;
    try {
      outputExists = await outputFile.exists();
      if (outputExists) {
        const stat = await outputFile.stat();
        outputBytes = stat?.size ?? 0;
      }
    } catch {}

    if (!outputExists || outputBytes < MIN_OUTPUT_BYTES) {
      if (attempt < 1) {
        continue;
      }
      const diag = await describeRenderDiagnostics(outputDir, projectDir);
      diag.outputExists = outputExists;
      diag.outputBytes = outputBytes;
      const reason = describeFailureReason(diag);
      throw new RenderOutputError(
        `Render produced invalid output (exists=${outputExists}, bytes=${outputBytes}). ${reason}`,
        diag,
      );
    }

    return outputPath;
  }

  throw new RenderOutputError(
    `Render failed after retry: ${lastError?.message ?? "unknown error"}`,
    await describeRenderDiagnostics(outputDir, projectDir),
  );
}

function describeFailureReason(diag: RenderDiagnostics): string {
  if (!diag.workDir) {
    return "No render work directory was created — render may not have started.";
  }
  if (!diag.compiledHtmlExists || diag.compiledHtmlBytes === 0) {
    return `Compile stage failed: compiled/index.html is empty or missing (bytes=${diag.compiledHtmlBytes}) at ${diag.workDir}/compiled/.`;
  }
  if (diag.capturedFramesCount === 0) {
    return `Capture stage failed: 0 frames captured (compiled/index.html was ${diag.compiledHtmlBytes} bytes). Chrome likely had nothing to render.`;
  }
  if (diag.outputBytes > 0 && diag.outputBytes < MIN_OUTPUT_BYTES) {
    return `Encode stage produced a ${diag.outputBytes}-byte file — too small to be a valid mp4. Captured ${diag.capturedFramesCount} frames.`;
  }
  return `Render failed for unknown reason. Work dir: ${diag.workDir}. Captured ${diag.capturedFramesCount} frames, output bytes=${diag.outputBytes}.`;
}
