import { describe, it, expect } from "bun:test";
import {
  validateCompositionHtml,
  lintCompositionHtml,
} from "./composition-validator";

const VALID_HTML = `<!doctype html>
<html lang="en">
  <head>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
  </head>
  <body>
    <div id="stage" data-composition-id="hypercut-test" data-start="0" data-width="1920" data-height="1080" data-duration="8.3">
      <video id="seg-0" class="clip" data-start="0" data-duration="5.2" data-track-index="0" src="source.mp4" data-has-audio="true" playsinline></video>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      tl.to({}, { duration: 8.3 });
      window.__timelines["hypercut-test"] = tl;
    </script>
  </body>
</html>`;

describe("validateCompositionHtml", () => {
  it("returns ok=true for a valid composition", async () => {
    const result = await validateCompositionHtml(VALID_HTML);
    expect(result.ok).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.compositionId).toBe("hypercut-test");
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.duration).toBe(8.3);
  });

  it("reports error when data-composition-id is missing", async () => {
    const html = VALID_HTML.replace('data-composition-id="hypercut-test" ', "");
    const result = await validateCompositionHtml(html);
    expect(result.ok).toBe(false);
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
    expect(result.findings.some(f => f.code === "missing_composition_id")).toBe(true);
  });

  it("reports error when data-width is missing", async () => {
    const html = VALID_HTML.replace('data-width="1920" ', "");
    const result = await validateCompositionHtml(html);
    expect(result.ok).toBe(false);
    expect(result.findings.some(f => f.code === "missing_width")).toBe(true);
  });

  it("reports error when data-height is missing", async () => {
    const html = VALID_HTML.replace('data-height="1080" ', "");
    const result = await validateCompositionHtml(html);
    expect(result.ok).toBe(false);
    expect(result.findings.some(f => f.code === "missing_height")).toBe(true);
  });

  it("reports error when window.__timelines registration is missing", async () => {
    const html = VALID_HTML.replace(
      /window\.__timelines\["hypercut-test"\] = tl;/,
      "",
    );
    const result = await validateCompositionHtml(html);
    expect(result.ok).toBe(false);
    expect(result.findings.some(f => f.code === "missing_timeline_registration")).toBe(true);
  });

  it("reports error when timeline key does not match composition id", async () => {
    const html = VALID_HTML.replace(
      'window.__timelines["hypercut-test"] = tl;',
      'window.__timelines["wrong-id"] = tl;',
    );
    const result = await validateCompositionHtml(html);
    expect(result.ok).toBe(false);
    expect(result.findings.some(f => f.code === "timeline_id_mismatch")).toBe(true);
  });

  it("reports error when gsap is not loaded", async () => {
    const html = VALID_HTML.replace(
      /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/gsap@3\/dist\/gsap\.min\.js"><\/script>/,
      "",
    );
    const result = await validateCompositionHtml(html);
    expect(result.ok).toBe(false);
    expect(result.findings.some(f => f.code === "missing_gsap_script")).toBe(true);
  });
});

describe("lintCompositionHtml", () => {
  it("returns 0 errors 0 warnings for a clean composition", async () => {
    const result = await lintCompositionHtml(VALID_HTML);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it("detects gsap_studio_edit_blocked warning", async () => {
    const html = VALID_HTML.replace(
      "tl.to({}, { duration: 8.3 });",
      'tl.fromTo("#seg-0", { opacity: 0 }, { opacity: 1, duration: 1 });\n      tl.to({}, { duration: 8.3 });',
    );
    const result = await lintCompositionHtml(html);
    expect(result.warningCount).toBeGreaterThanOrEqual(1);
    expect(result.findings.some(f => f.code === "gsap_studio_edit_blocked")).toBe(true);
  });
});
