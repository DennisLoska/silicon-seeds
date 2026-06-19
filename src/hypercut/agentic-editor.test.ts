import { describe, it, expect, beforeAll } from "bun:test";
import { autoFixLint } from "./agentic-editor";
import { Logger } from "../logger/logger";

beforeAll(async () => {
  try { await Logger.init(); } catch {}
});

const HTML_NO_ISSUES = `<!doctype html>
<html><head>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
</head><body>
<div id="stage" data-composition-id="hypercut-test" data-start="0" data-width="1920" data-height="1080" data-duration="55">
  <video id="seg-0" class="clip" data-start="0" data-duration="5" data-track-index="0" src="source.mp4" data-has-audio="true" playsinline></video>
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
tl.to({}, { duration: 55 });
window.__timelines["hypercut-test"] = tl;
</script>
</body></html>`;

describe("autoFixLint", () => {
  it("does nothing when there are no error findings", async () => {
    const tmpPath = `/tmp/opencode/ss-agentic-noop-${Date.now()}.html`;
    await Bun.write(tmpPath, HTML_NO_ISSUES);
    const fixed = await autoFixLint(tmpPath, []);
    expect(fixed).toBeNull();
  });

  it("does not auto-fix gsap_studio_edit_blocked warnings", async () => {
    const tmpPath = `/tmp/opencode/ss-agentic-warning-${Date.now()}.html`;
    await Bun.write(tmpPath, HTML_NO_ISSUES);
    const findings = [{
      code: "gsap_studio_edit_blocked",
      severity: "warning" as const,
      message: 'GSAP tweens target "#seg-0" in a registered timeline.',
    }];
    const fixed = await autoFixLint(tmpPath, findings);
    expect(fixed).toBeNull();
  });
});
