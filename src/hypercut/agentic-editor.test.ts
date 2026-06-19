import { describe, it, expect, beforeAll } from "bun:test";
import { autoFixLint } from "./agentic-editor";
import { Logger } from "../logger/logger";

beforeAll(async () => {
  try { await Logger.init(); } catch {}
});

const HTML_WITH_GSAP_FROMTO = `<!doctype html>
<html><head>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
</head><body>
<div id="stage" data-composition-id="hypercut-test" data-start="0" data-width="1920" data-height="1080" data-duration="55">
  <video id="seg-0" class="clip" data-start="0" data-duration="5" data-track-index="0" src="source.mp4" data-has-audio="true" playsinline></video>
  <img id="sugg-abc" class="clip" data-start="1.5" data-duration="1.19" data-track-index="1" src="img.png" style="opacity: 0; transform: scale(0.3) rotate(-15deg);">
</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
tl.fromTo("#sugg-abc",
  { scale: 0.3, rotation: -15, opacity: 0 },
  { scale: 0.6, rotation: 5, opacity: 1, duration: 1.19, ease: "power2.out" }
);
tl.to({}, { duration: 55 });
window.__timelines["hypercut-test"] = tl;
</script>
</body></html>`;

describe("autoFixLint (exported for testing)", () => {
  it("converts gsap fromTo on clip element to CSS @keyframes and removes the tween", async () => {
    const tmpPath = `/tmp/opencode/ss-agentic-${Date.now()}-${Math.random().toString(36).slice(2)}.html`;
    await Bun.write(tmpPath, HTML_WITH_GSAP_FROMTO);
    const findings = [{
      code: "gsap_studio_edit_blocked",
      severity: "warning" as const,
      message: 'GSAP tweens target "#sugg-abc" in a registered timeline.',
    }];
    const fixed = await autoFixLint(tmpPath, findings);
    expect(fixed).not.toBeNull();
    const out = await Bun.file(tmpPath).text();
    expect(out).toContain("@keyframes sugg-abc-anim");
    expect(out).toContain("animation: sugg-abc-anim 1.19s ease-out 1.5s 1 both");
    expect(out).not.toContain('tl.fromTo("#sugg-abc"');
    expect(out).toContain('window.__timelines["hypercut-test"] = tl');
  });

  it("leaves the GSAP tween alone when props are unsupported", async () => {
    const html = HTML_WITH_GSAP_FROMTO.replace(
      "{ scale: 0.3, rotation: -15, opacity: 0 }",
      "{ filter: 'blur(5px)' }",
    ).replace(
      "{ scale: 0.6, rotation: 5, opacity: 1, duration: 1.19, ease: \"power2.out\" }",
      "{ filter: 'blur(0px)', duration: 1.19, ease: \"power2.out\" }",
    );
    const tmpPath = `/tmp/opencode/ss-agentic-unsupported-${Date.now()}-${Math.random().toString(36).slice(2)}.html`;
    await Bun.write(tmpPath, html);
    const findings = [{
      code: "gsap_studio_edit_blocked",
      severity: "warning" as const,
      message: 'GSAP tweens target "#sugg-abc" in a registered timeline.',
    }];
    const fixed = await autoFixLint(tmpPath, findings);
    expect(fixed).toBeNull();
    const out = await Bun.file(tmpPath).text();
    expect(out).toContain('tl.fromTo');
  });

  it("does nothing when there are no findings to fix", async () => {
    const tmpPath = `/tmp/opencode/ss-agentic-noop-${Date.now()}-${Math.random().toString(36).slice(2)}.html`;
    await Bun.write(tmpPath, HTML_WITH_GSAP_FROMTO);
    const fixed = await autoFixLint(tmpPath, []);
    expect(fixed).toBeNull();
  });
});
