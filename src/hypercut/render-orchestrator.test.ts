import { describe, it, expect } from "bun:test";
import { mkdirSync } from "node:fs";
import {
  renderWithValidation,
  describeRenderDiagnostics,
  RenderValidationError,
  RenderOutputError,
} from "./render-orchestrator";

async function writeWithDirs(path: string, content: string): Promise<void> {
  const { dirname } = await import("node:path");
  mkdirSync(dirname(path), { recursive: true });
  await Bun.write(path, content);
}

const VALID_HTML = `<!doctype html>
<html><head>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
</head><body>
<div id="stage" data-composition-id="hypercut-test" data-start="0" data-width="1920" data-height="1080" data-duration="5">
  <video id="seg-0" class="clip" data-start="0" data-duration="5" data-track-index="0" src="source.mp4" data-has-audio="true" playsinline></video>
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
tl.to({}, { duration: 5 });
window.__timelines["hypercut-test"] = tl;
</script>
</body></html>`;

async function makeTmpDir(prefix: string): Promise<string> {
  const dir = `/tmp/ss-test-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return dir;
}

describe("describeRenderDiagnostics", () => {
  it("returns zeros when project dir does not exist", async () => {
    const diag = await describeRenderDiagnostics("/tmp/opencode/nonexistent-output", "/tmp/opencode/nonexistent-project");
    expect(diag.workDir).toBeNull();
    expect(diag.compiledHtmlExists).toBe(false);
    expect(diag.compiledHtmlBytes).toBe(0);
    expect(diag.capturedFramesCount).toBe(0);
  });

  it("reads the newest work dir and inspects compiled/captured-frames", async () => {
    const projectDir = await makeTmpDir("diag");
    const rendersDir = `${projectDir}/renders`;
    const workDir = `${rendersDir}/work-aaa`;
    await writeWithDirs(`${workDir}/compiled/index.html`, "<html>compiled</html>");
    await writeWithDirs(`${workDir}/captured-frames/frame_000001.jpg`, "jpeg-bytes");
    await writeWithDirs(`${workDir}/captured-frames/frame_000002.jpg`, "jpeg-bytes");
    const diag = await describeRenderDiagnostics("/tmp/opencode/ss-test-output-" + Date.now(), projectDir);
    expect(diag.workDir).toBe(workDir);
    expect(diag.compiledHtmlExists).toBe(true);
    expect(diag.compiledHtmlBytes).toBeGreaterThan(0);
    expect(diag.capturedFramesCount).toBe(2);
  });

  it("detects empty compiled/index.html", async () => {
    const projectDir = await makeTmpDir("empty-compiled");
    const workDir = `${projectDir}/renders/work-empty`;
    await writeWithDirs(`${workDir}/compiled/index.html`, "");
    const diag = await describeRenderDiagnostics("/tmp/opencode/ss-test-output-" + Date.now(), projectDir);
    expect(diag.compiledHtmlExists).toBe(true);
    expect(diag.compiledHtmlBytes).toBe(0);
  });
});

describe("renderWithValidation", () => {
  it("throws RenderValidationError when source composition is missing", async () => {
    const tmpDir = await makeTmpDir("missing");
    await expect(renderWithValidation("no-such-job", tmpDir))
      .rejects.toBeInstanceOf(RenderValidationError);
  });

  it("throws RenderValidationError when composition is empty", async () => {
    const tmpDir = await makeTmpDir("empty-src");
    await Bun.write(`${tmpDir}/hypercut-empty/index.html`, "   ");
    await expect(renderWithValidation("empty", tmpDir))
      .rejects.toBeInstanceOf(RenderValidationError);
  });

  it("throws RenderValidationError when composition has structural errors", async () => {
    const tmpDir = await makeTmpDir("bad-struct");
    const badHtml = VALID_HTML.replace('data-composition-id="hypercut-test"', "");
    await Bun.write(`${tmpDir}/hypercut-bad/index.html`, badHtml);
    await expect(renderWithValidation("bad", tmpDir))
      .rejects.toBeInstanceOf(RenderValidationError);
  });

  it("returns output path when render produces a valid file", async () => {
    const tmpDir = await makeTmpDir("ok");
    await Bun.write(`${tmpDir}/hypercut-ok/index.html`, VALID_HTML);
    const outputPath = `${tmpDir}/hypercut-ok.mp4`;
    await Bun.write(outputPath, "x".repeat(2048));
    const mod = await import("./hypercut-workflow");
    const original = mod.HyperCutWorkflow.render;
    mod.HyperCutWorkflow.render = async () => outputPath;
    try {
      const result = await renderWithValidation("ok", tmpDir);
      expect(result).toBe(outputPath);
    } finally {
      mod.HyperCutWorkflow.render = original;
    }
  });

  it("throws RenderOutputError when output is empty", async () => {
    const tmpDir = await makeTmpDir("empty-out");
    await Bun.write(`${tmpDir}/hypercut-emptyout/index.html`, VALID_HTML);
    const outputPath = `${tmpDir}/hypercut-emptyout.mp4`;
    await Bun.write(outputPath, "");
    const mod = await import("./hypercut-workflow");
    const original = mod.HyperCutWorkflow.render;
    mod.HyperCutWorkflow.render = async () => outputPath;
    try {
      await expect(renderWithValidation("emptyout", tmpDir))
        .rejects.toBeInstanceOf(RenderOutputError);
    } finally {
      mod.HyperCutWorkflow.render = original;
    }
  });

  it("throws RenderOutputError when render stage throws, with diagnostics", async () => {
    const tmpDir = await makeTmpDir("render-throws");
    const projectDir = `${tmpDir}/hypercut-throws`;
    await Bun.write(`${projectDir}/index.html`, VALID_HTML);
    const workDir = `${projectDir}/renders/work-throws`;
    await Bun.write(`${workDir}/compiled/index.html`, "");
    const mod = await import("./hypercut-workflow");
    const original = mod.HyperCutWorkflow.render;
    mod.HyperCutWorkflow.render = async () => {
      throw new Error("ffmpeg exited with code 234");
    };
    try {
      await expect(renderWithValidation("throws", tmpDir))
        .rejects.toBeInstanceOf(RenderOutputError);
    } finally {
      mod.HyperCutWorkflow.render = original;
    }
  });
});
