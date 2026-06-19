# Hypercut Render Robustness + Lint Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hypercut rendering pipeline fail with actionable errors instead of cryptic FFmpeg stderr; fix `gsap_studio_edit_blocked` lint warning by converting GSAP `fromTo` on clip elements to CSS `@keyframes`; stop linting `renders/` build artifacts.

**Architecture:** Three new pure-function modules (`composition-validator.ts`, `gsap-to-css.ts`, `render-orchestrator.ts`) wrap the existing `HyperCutWorkflow.render` call with pre-render validation + post-render diagnostics. The agentic editor switches from spawning `npx hyperframes lint` on the project dir (which scans `renders/`) to calling `lintHyperframeHtml` from `@hyperframes/core` on the source HTML string only. A GSAP-to-CSS converter replaces `tl.fromTo("#id", ...)` calls with `@keyframes` + `animation:` shorthand so the `gsap_studio_edit_blocked` warning no longer fires.

**Tech Stack:** Bun, TypeScript, `bun:test`, `@hyperframes/core` (`lintHyperframeHtml`), `@hyperframes/producer` (`createRenderJob`, `executeRenderJob`).

**Spec:** `docs/superpowers/specs/2026-06-19-hypercut-render-robustness-design.md`

---

## File Map

| File | Role | Action |
|---|---|---|
| `src/hypercut/gsap-to-css.ts` | Pure converter: GSAP `tl.fromTo` → CSS `@keyframes` | Create |
| `src/hypercut/gsap-to-css.test.ts` | Test the converter | Create |
| `src/hypercut/composition-validator.ts` | Static structural + HF lint validation of source HTML | Create |
| `src/hypercut/composition-validator.test.ts` | Test the validator | Create |
| `src/hypercut/render-orchestrator.ts` | Wrap `HyperCutWorkflow.render` with validation + diagnostics | Create |
| `src/hypercut/render-orchestrator.test.ts` | Test the orchestrator (mocks `HyperCutWorkflow.render`) | Create |
| `src/hypercut/agentic-editor.ts` | Switch to programmatic lint; extend autoFixLint; update system prompt | Modify |
| `src/hypercut/agentic-editor.test.ts` | Test autoFixLint GSAP-to-CSS path | Create |
| `src/api/api/hypercut.ts` | `render_job` calls `renderWithValidation`; structured error bodies | Modify |
| `src/hypercut/hypercut-workflow.ts` | No signature change; stays as low-level render | Unchanged |
| `/run/media/dennis/ai/comfy-ui/output/hypercut-019edaa4-.../index.html` | Convert existing GSAP fromTo to CSS keyframes | Fix in-place via task 6 script |

---

## Task 1: GSAP-to-CSS Converter

**Files:**
- Create: `src/hypercut/gsap-to-css.ts`
- Create: `src/hypercut/gsap-to-css.test.ts`

- [ ] **Step 1: Write the failing test**

`src/hypercut/gsap-to-css.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { gsapFromToToCss, parseGsapFromToCalls, type GsapTween } from "./gsap-to-css";

describe("gsapFromToToCss", () => {
  it("converts opacity + scale + rotation fromTo into @keyframes", () => {
    const tween: GsapTween = {
      selector: "#sugg-abc",
      fromProps: { scale: 0.3, rotation: -15, opacity: 0 },
      toProps: { scale: 0.6, rotation: 5, opacity: 1 },
      duration: 1.19,
      ease: "power2.out",
      position: 1.5,
    };
    const css = gsapFromToToCss(tween);
    expect(css).not.toBeNull();
    expect(css!.name).toBe("sugg-abc-anim");
    expect(css!.selector).toBe("#sugg-abc");
    expect(css!.keyframes).toContain("@keyframes sugg-abc-anim");
    expect(css!.keyframes).toContain("opacity: 0");
    expect(css!.keyframes).toContain("opacity: 1");
    expect(css!.keyframes).toContain("transform: scale(0.3) rotate(-15deg)");
    expect(css!.keyframes).toContain("transform: scale(0.6) rotate(5deg)");
    expect(css!.animationDecl).toContain("animation: sugg-abc-anim 1.19s ease-out 1.5s 1 both");
  });

  it("returns null when selector is not an id selector", () => {
    const tween: GsapTween = {
      selector: ".overlay",
      fromProps: { opacity: 0 },
      toProps: { opacity: 1 },
      duration: 1,
    };
    expect(gsapFromToToCss(tween)).toBeNull();
  });

  it("returns null when props contain unsupported keys", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { filter: "blur(5px)" },
      toProps: { filter: "blur(0px)" },
      duration: 1,
    };
    expect(gsapFromToToCss(tween)).toBeNull();
  });

  it("maps ease power3.in to ease-in", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { opacity: 0 },
      toProps: { opacity: 1 },
      duration: 1,
      ease: "power3.in",
    };
    const css = gsapFromToToCss(tween);
    expect(css!.animationDecl).toContain("ease-in");
  });

  it("defaults ease to ease-out when ease is missing", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { opacity: 0 },
      toProps: { opacity: 1 },
      duration: 1,
    };
    const css = gsapFromToToCss(tween);
    expect(css!.animationDecl).toContain("ease-out");
  });

  it("handles x/y translate props", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { x: -100, opacity: 0 },
      toProps: { x: 0, opacity: 1 },
      duration: 1,
    };
    const css = gsapFromToToCss(tween);
    expect(css!.keyframes).toContain("transform: translate(-100px, 0px)");
    expect(css!.keyframes).toContain("transform: translate(0px, 0px)");
  });

  it("handles backgroundColor", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { backgroundColor: "#ff0000" },
      toProps: { backgroundColor: "#00ff00" },
      duration: 1,
    };
    const css = gsapFromToToCss(tween);
    expect(css!.keyframes).toContain("background-color: #ff0000");
    expect(css!.keyframes).toContain("background-color: #00ff00");
  });

  it("handles position 0 (no delay suffix)", () => {
    const tween: GsapTween = {
      selector: "#x",
      fromProps: { opacity: 0 },
      toProps: { opacity: 1 },
      duration: 1,
      position: 0,
    };
    const css = gsapFromToToCss(tween);
    expect(css!.animationDecl).toBe("animation: x-anim 1s ease-out 0s 1 both");
  });
});

describe("parseGsapFromToCalls", () => {
  it("extracts a tl.fromTo call with numeric props", () => {
    const script = `
      const tl = gsap.timeline({ paused: true });
      tl.fromTo("#sugg-abc",
        { scale: 0.3, rotation: -15, opacity: 0 },
        { scale: 0.6, rotation: 5, opacity: 1, duration: 1.19, ease: "power2.out" }
      );
      tl.to({}, { duration: 55 });
    `;
    const calls = parseGsapFromToCalls(script);
    expect(calls.length).toBe(1);
    expect(calls[0].selector).toBe("#sugg-abc");
    expect(calls[0].fromProps.scale).toBe(0.3);
    expect(calls[0].toProps.scale).toBe(0.6);
    expect(calls[0].duration).toBe(1.19);
    expect(calls[0].ease).toBe("power2.out");
    expect(calls[0].position).toBe(0);
  });

  it("returns empty array when no fromTo calls", () => {
    const script = `const tl = gsap.timeline({ paused: true }); tl.to({}, { duration: 5 });`;
    expect(parseGsapFromToCalls(script)).toEqual([]);
  });

  it("handles fromTo with a leading position argument", () => {
    const script = `
      tl.fromTo("#x", { opacity: 0 }, { opacity: 1, duration: 1 }, 1.5);
    `;
    const calls = parseGsapFromToCalls(script);
    expect(calls.length).toBe(1);
    expect(calls[0].position).toBe(1.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/hypercut/gsap-to-css.test.ts
```

Expected: FAIL — `Cannot find module "./gsap-to-css"`.

- [ ] **Step 3: Write minimal implementation**

`src/hypercut/gsap-to-css.ts`:

```ts
export interface GsapTween {
  selector: string;
  fromProps: Record<string, number | string>;
  toProps: Record<string, number | string>;
  duration: number;
  ease?: string;
  position?: number;
}

export interface CssAnimation {
  name: string;
  keyframes: string;
  animationDecl: string;
  selector: string;
}

const SUPPORTED_PROPS = new Set([
  "opacity",
  "scale",
  "rotation",
  "x",
  "y",
  "backgroundColor",
]);

const EASE_MAP: Record<string, string> = {
  "power1.out": "ease-out",
  "power2.out": "ease-out",
  "power3.out": "ease-out",
  "power4.out": "ease-out",
  "sine.out": "ease-out",
  "power1.in": "ease-in",
  "power2.in": "ease-in",
  "power3.in": "ease-in",
  "power4.in": "ease-in",
  "sine.in": "ease-in",
  "power1.inOut": "ease-in-out",
  "power2.inOut": "ease-in-out",
  "power3.inOut": "ease-in-out",
  "power4.inOut": "ease-in-out",
  "sine.inOut": "ease-in-out",
  "none": "linear",
};

function buildTransform(props: Record<string, number | string>): string | null {
  const scale = props.scale;
  const rotation = props.rotation;
  const x = props.x;
  const y = props.y;
  const parts: string[] = [];
  if (x !== undefined) parts.push(`translate(${x}px, ${y ?? 0}px)`);
  if (scale !== undefined) parts.push(`scale(${scale})`);
  if (rotation !== undefined) parts.push(`rotate(${rotation}deg)`);
  return parts.length > 0 ? parts.join(" ") : null;
}

function propsToCss(props: Record<string, number | string>): string {
  const lines: string[] = [];
  if (props.opacity !== undefined) lines.push(`opacity: ${props.opacity}`);
  if (props.backgroundColor !== undefined) lines.push(`background-color: ${props.backgroundColor}`);
  const transform = buildTransform(props);
  if (transform) lines.push(`transform: ${transform}`);
  return lines.join("; ");
}

export function gsapFromToToCss(tween: GsapTween): CssAnimation | null {
  if (!tween.selector.startsWith("#")) return null;

  const allProps = new Set<string>([
    ...Object.keys(tween.fromProps),
    ...Object.keys(tween.toProps),
  ]);
  for (const prop of allProps) {
    if (!SUPPORTED_PROPS.has(prop)) return null;
  }

  const id = tween.selector.slice(1);
  const name = `${id}-anim`;
  const fromCss = propsToCss(tween.fromProps);
  const toCss = propsToCss(tween.toProps);
  const ease = EASE_MAP[tween.ease ?? "power2.out"] ?? "ease-out";
  const position = tween.position ?? 0;

  const keyframes = `@keyframes ${name} { from { ${fromCss}; } to { ${toCss}; } }`;
  const animationDecl = `animation: ${name} ${tween.duration}s ${ease} ${position}s 1 both`;

  return { name, keyframes, animationDecl, selector: tween.selector };
}

export function parseGsapFromToCalls(scriptContent: string): GsapTween[] {
  const calls: GsapTween[] = [];
  const re =
    /\.fromTo\s*\(\s*["']([#.][^"']+)["']\s*,\s*\{([\s\S]*?)\}\s*,\s*\{([\s\S]*?)\}\s*(?:,\s*([0-9.]+))?\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(scriptContent)) !== null) {
    const selector = match[1];
    const fromBlock = match[2];
    const toBlock = match[3];
    const positionStr = match[4];
    const fromProps = parsePropsBlock(fromBlock);
    const toProps = parsePropsBlock(toBlock);
    const duration = typeof toProps.duration === "number" ? toProps.duration : 0;
    const ease = typeof toProps.ease === "string" ? toProps.ease : undefined;
    if (duration <= 0) continue;
    const cleanedFrom = { ...fromProps };
    const cleanedTo = { ...toProps };
    delete cleanedFrom.duration;
    delete cleanedFrom.ease;
    delete cleanedTo.duration;
    delete cleanedTo.ease;
    calls.push({
      selector,
      fromProps: cleanedFrom,
      toProps: cleanedTo,
      duration,
      ease,
      position: positionStr ? Number(positionStr) : 0,
    });
  }
  return calls;
}

function parsePropsBlock(block: string): Record<string, number | string> {
  const props: Record<string, number | string> = {};
  const re = /([A-Za-z_]+)\s*:\s*([0-9.]+|"[^"]*"|'[^']*')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const key = m[1];
    const raw = m[2];
    if (raw.startsWith('"') || raw.startsWith("'")) {
      props[key] = raw.slice(1, -1);
    } else {
      props[key] = Number(raw);
    }
  }
  return props;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/hypercut/gsap-to-css.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hypercut/gsap-to-css.ts src/hypercut/gsap-to-css.test.ts
git commit -m "feat(hypercut): add GSAP fromTo to CSS @keyframes converter"
```

---

## Task 2: Composition Validator

**Files:**
- Create: `src/hypercut/composition-validator.ts`
- Create: `src/hypercut/composition-validator.test.ts`

- [ ] **Step 1: Write the failing test**

`src/hypercut/composition-validator.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/hypercut/composition-validator.test.ts
```

Expected: FAIL — `Cannot find module "./composition-validator"`.

- [ ] **Step 3: Write minimal implementation**

`src/hypercut/composition-validator.ts`:

```ts
import { lintHyperframeHtml } from "@hyperframes/core";

export interface CompositionValidationFinding {
  code: string;
  severity: "error" | "warning";
  message: string;
  fixHint?: string;
}

export interface CompositionValidationResult {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  findings: CompositionValidationFinding[];
  compositionId: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
}

function findRootComposition(html: string): { id: string; raw: string } | null {
  const re = /<([a-zA-Z]+)\b[^>]*\bdata-composition-id="([^"]+)"[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1].toLowerCase();
    if (tag === "html") continue;
    return { id: m[2], raw: m[0] };
  }
  return null;
}

function readAttr(raw: string, name: string): string | null {
  const re = new RegExp(`\\b${name}="([^"]*)"`);
  const m = raw.match(re);
  return m ? m[1] : null;
}

export async function validateCompositionHtml(
  html: string,
): Promise<CompositionValidationResult> {
  const findings: CompositionValidationFinding[] = [];
  let compositionId: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let duration: number | null = null;

  const root = findRootComposition(html);
  if (!root) {
    findings.push({
      code: "missing_composition_id",
      severity: "error",
      message: "Root composition is missing data-composition-id. Add a stable data-composition-id to the entry composition wrapper.",
    });
  } else {
    compositionId = root.id;
    const w = readAttr(root.raw, "data-width");
    const h = readAttr(root.raw, "data-height");
    const d = readAttr(root.raw, "data-duration");
    if (!w) {
      findings.push({
        code: "missing_width",
        severity: "error",
        message: "Root composition is missing data-width. Set numeric data-width on the entry composition root.",
      });
    } else {
      width = Number(w);
    }
    if (!h) {
      findings.push({
        code: "missing_height",
        severity: "error",
        message: "Root composition is missing data-height. Set numeric data-height on the entry composition root.",
      });
    } else {
      height = Number(h);
    }
    if (!d) {
      findings.push({
        code: "missing_duration",
        severity: "error",
        message: "Root composition is missing data-duration. Set numeric data-duration (seconds) on the entry composition root.",
      });
    } else {
      duration = Number(d);
    }
  }

  const hasTimelineRegistration = /window\.__timelines\[/.test(html);
  if (!hasTimelineRegistration) {
    findings.push({
      code: "missing_timeline_registration",
      severity: "error",
      message: "Missing window.__timelines registration. Register each composition timeline on window.__timelines[compositionId].",
    });
  } else if (compositionId) {
    const re = new RegExp(`window\\.__timelines\\["${compositionId}"\\]`);
    if (!re.test(html)) {
      findings.push({
        code: "timeline_id_mismatch",
        severity: "error",
        message: `window.__timelines key does not match composition id "${compositionId}".`,
      });
    }
  }

  const hasGsapScript = /<script[^>]*src="[^"]*gsap[^"]*"[^>]*>/i.test(html);
  const hasInlineGsap = /gsap\.(timeline|to|from|fromTo|set)\s*\(/.test(html);
  if (hasInlineGsap && !hasGsapScript) {
    const hasInlinedBundle = /\/\*\s*inlined:.*gsap/i.test(html) || /\b_gsScope\b/.test(html);
    if (!hasInlinedBundle) {
      findings.push({
        code: "missing_gsap_script",
        severity: "error",
        message: "Composition uses GSAP but no GSAP script is loaded. Add <script src=\"https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js\"></script> before your animation script.",
      });
    }
  }

  const errorCount = findings.filter(f => f.severity === "error").length;
  return {
    ok: errorCount === 0,
    errorCount,
    warningCount: 0,
    findings,
    compositionId,
    width,
    height,
    duration,
  };
}

export async function lintCompositionHtml(
  html: string,
): Promise<CompositionValidationResult> {
  const structural = await validateCompositionHtml(html);
  const lintResult = await lintHyperframeHtml(html);
  const lintFindings: CompositionValidationFinding[] = lintResult.findings.map(f => ({
    code: f.code,
    severity: f.severity as "error" | "warning",
    message: f.message,
    fixHint: f.fixHint,
  }));
  const merged = [...structural.findings, ...lintFindings];
  const dedup = new Map<string, CompositionValidationFinding>();
  for (const f of merged) {
    const key = `${f.code}|${f.severity}|${f.message}`;
    if (!dedup.has(key)) dedup.set(key, f);
  }
  const findings = [...dedup.values()];
  const errorCount = findings.filter(f => f.severity === "error").length;
  const warningCount = findings.filter(f => f.severity === "warning").length;
  return {
    ok: errorCount === 0,
    errorCount,
    warningCount,
    findings,
    compositionId: structural.compositionId,
    width: structural.width,
    height: structural.height,
    duration: structural.duration,
  };
}

export async function validateCompositionFile(
  compPath: string,
): Promise<CompositionValidationResult> {
  const file = Bun.file(compPath);
  if (!(await file.exists())) {
    return {
      ok: false,
      errorCount: 1,
      warningCount: 0,
      findings: [{
        code: "missing_file",
        severity: "error",
        message: `Composition file not found: ${compPath}`,
      }],
      compositionId: null,
      width: null,
      height: null,
      duration: null,
    };
  }
  const html = await file.text();
  return validateCompositionHtml(html);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/hypercut/composition-validator.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hypercut/composition-validator.ts src/hypercut/composition-validator.test.ts
git commit -m "feat(hypercut): add composition validator + programmatic lint"
```

---

## Task 3: Render Orchestrator (validation wrapper + diagnostics)

**Files:**
- Create: `src/hypercut/render-orchestrator.ts`
- Create: `src/hypercut/render-orchestrator.test.ts`

- [ ] **Step 1: Write the failing test**

`src/hypercut/render-orchestrator.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { join } from "node:path";
import {
  renderWithValidation,
  describeRenderDiagnostics,
  RenderValidationError,
  RenderOutputError,
} from "./render-orchestrator";

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

describe("describeRenderDiagnostics", () => {
  it("returns zeros when work dir does not exist", async () => {
    const diag = await describeRenderDiagnostics("/tmp/nonexistent-project-dir-xyz");
    expect(diag.workDir).toBeNull();
    expect(diag.compiledHtmlExists).toBe(false);
    expect(diag.compiledHtmlBytes).toBe(0);
    expect(diag.capturedFramesCount).toBe(0);
  });
});

describe("renderWithValidation", () => {
  let tmpProjectDir: string;
  let tmpOutputDir: string;
  let renderMock: ReturnType<typeof mock>;

  beforeEach(() => {
    tmpProjectDir = `/tmp/ss-test-${Date.now()}-${Math.random().toString(36).slice(2)}/project`;
    tmpOutputDir = `/tmp/ss-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    Bun.write(`${tmpProjectDir}/index.html`, VALID_HTML);
    renderMock = mock(() => Promise.resolve(`${tmpOutputDir}/out.mp4`));
  });

  afterEach(() => {
    // cleanup tmp dirs is best-effort
  });

  it("throws RenderValidationError when source composition is missing", async () => {
    await expect(renderWithValidation("nonexistent-job", "/tmp/no-such-dir"))
      .rejects.toThrow();
  });

  it("throws RenderValidationError when composition has lint errors", async () => {
    const badHtml = VALID_HTML.replace('data-composition-id="hypercut-test"', "");
    const tmpDir = `/tmp/ss-test-bad-${Date.now()}`;
    await Bun.write(`${tmpDir}/hypercut-badjob/index.html`, badHtml);
    await expect(renderWithValidation("badjob", tmpDir))
      .rejects.toBeInstanceOf(RenderValidationError);
  });

  it("returns output path when render produces a valid file", async () => {
    const tmpDir = `/tmp/ss-test-ok-${Date.now()}`;
    const projectDir = `${tmpDir}/hypercut-okjob`;
    await Bun.write(`${projectDir}/index.html`, VALID_HTML);
    const outputPath = `${tmpDir}/hypercut-okjob.mp4`;
    await Bun.write(outputPath, "x".repeat(2048));
    const { HyperCutWorkflow } = await import("./hypercut-workflow");
    const original = HyperCutWorkflow.render;
    HyperCutWorkflow.render = async () => outputPath;
    try {
      const result = await renderWithValidation("okjob", tmpDir);
      expect(result).toBe(outputPath);
    } finally {
      HyperCutWorkflow.render = original;
    }
  });

  it("throws RenderOutputError when output is empty", async () => {
    const tmpDir = `/tmp/ss-test-empty-${Date.now()}`;
    const projectDir = `${tmpDir}/hypercut-emptyjob`;
    await Bun.write(`${projectDir}/index.html`, VALID_HTML);
    const outputPath = `${tmpDir}/hypercut-emptyjob.mp4`;
    await Bun.write(outputPath, "");
    const { HyperCutWorkflow } = await import("./hypercut-workflow");
    const original = HyperCutWorkflow.render;
    HyperCutWorkflow.render = async () => outputPath;
    try {
      await expect(renderWithValidation("emptyjob", tmpDir))
        .rejects.toBeInstanceOf(RenderOutputError);
    } finally {
      HyperCutWorkflow.render = original;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/hypercut/render-orchestrator.test.ts
```

Expected: FAIL — `Cannot find module "./render-orchestrator"`.

- [ ] **Step 3: Write minimal implementation**

`src/hypercut/render-orchestrator.ts`:

```ts
import { join } from "node:path";
import { HyperCutWorkflow } from "./hypercut-workflow";
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
  projectDir: string,
): Promise<RenderDiagnostics> {
  const rendersDir = join(projectDir, "renders");
  let workDir: string | null = null;
  try {
    const entries = await Array.fromAsync(new Bun.Glob("work-*").scan({ cwd: rendersDir }));
    if (entries.length === 0) {
      return {
        workDir: null,
        compiledHtmlExists: false,
        compiledHtmlBytes: 0,
        capturedFramesCount: 0,
        outputExists: false,
        outputBytes: 0,
      };
    }
    let newestMtime = 0;
    for (const name of entries) {
      const fullPath = join(rendersDir, name);
      try {
        const stat = await Bun.file(fullPath).stat();
        if (stat && stat.mtimeMs > newestMtime) {
          newestMtime = stat.mtimeMs;
          workDir = fullPath;
        }
      } catch {}
    }
  } catch {
    return {
      workDir: null,
      compiledHtmlExists: false,
      compiledHtmlBytes: 0,
      capturedFramesCount: 0,
      outputExists: false,
      outputBytes: 0,
    };
  }

  if (!workDir) {
    return {
      workDir: null,
      compiledHtmlExists: false,
      compiledHtmlBytes: 0,
      capturedFramesCount: 0,
      outputExists: false,
      outputBytes: 0,
    };
  }

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
    const frames = await Array.fromAsync(
      new Bun.Glob("frame_*.jpg").scan({ cwd: join(workDir, "captured-frames") }),
    );
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

  let outputPath: string;
  try {
    outputPath = await HyperCutWorkflow.render(jobId, outputDir);
  } catch (renderError) {
    const diag = await describeRenderDiagnostics(projectDir);
    const reason = describeFailureReason(diag);
    const renderMsg = renderError instanceof Error ? renderError.message : String(renderError);
    throw new RenderOutputError(
      `Render stage failed: ${renderMsg}. ${reason}`,
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
    const diag = await describeRenderDiagnostics(projectDir);
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/hypercut/render-orchestrator.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hypercut/render-orchestrator.ts src/hypercut/render-orchestrator.test.ts
git commit -m "feat(hypercut): add renderWithValidation + diagnostics wrapper"
```

---

## Task 4: Agentic Editor — programmatic lint + autoFixLint GSAP-to-CSS + system prompt

**Files:**
- Modify: `src/hypercut/agentic-editor.ts`
- Create: `src/hypercut/agentic-editor.test.ts`

- [ ] **Step 1: Write the failing test**

`src/hypercut/agentic-editor.test.ts`:

```ts
import { describe, it, expect } from "bun:test";
import { autoFixLint } from "./agentic-editor";

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
    const tmpPath = `/tmp/ss-agentic-${Date.now()}.html`;
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
    const tmpPath = `/tmp/ss-agentic-unsupported-${Date.now()}.html`;
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
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test src/hypercut/agentic-editor.test.ts
```

Expected: FAIL — `autoFixLint is not exported` or `Cannot find module`.

- [ ] **Step 3: Modify agentic-editor.ts**

Three changes:

(a) Export `autoFixLint` for testing.

(b) Replace the `lintComposition` function body to call `lintCompositionHtml` from the new module on the source HTML, instead of spawning `npx hyperframes lint` on `projectDir`.

(c) Extend `autoFixLint` to handle the `gsap_studio_edit_blocked` warning by converting `tl.fromTo("#id", ...)` calls to CSS `@keyframes`.

(d) Update the system prompt rule about CSS animations.

The full new content of `src/hypercut/agentic-editor.ts` (replacing the existing file):

```ts
import path from "node:path";
import { tool } from "@lmstudio/sdk";
import z from "zod/v3";
import { LLM } from "../llm/llm";
import { ChatLike } from "@lmstudio/sdk";
import { DB } from "../db/db";
import { Chroma } from "../chroma/chroma";
import { Logger } from "../logger/logger";
import {
  lintCompositionHtml,
  type CompositionValidationFinding,
} from "./composition-validator";
import {
  gsapFromToToCss,
  parseGsapFromToCalls,
} from "./gsap-to-css";

let systemPrompt = "";
let loaded = false;

export interface LintFinding {
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
  file?: string;
  fix?: string;
  fixHint?: string;
}

interface LintResult {
  ok: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  findings: LintFinding[];
}

async function lintComposition(projectDir: string): Promise<LintResult> {
  const compPath = `${projectDir}/index.html`;
  try {
    const file = Bun.file(compPath);
    if (!(await file.exists())) {
      return {
        ok: false,
        errorCount: 1,
        warningCount: 0,
        infoCount: 0,
        findings: [{
          severity: "error",
          message: `Composition not found at ${compPath}`,
        }],
      };
    }
    const html = await file.text();
    const result = await lintCompositionHtml(html);
    return {
      ok: result.ok,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      infoCount: 0,
      findings: result.findings.map(f => ({
        severity: f.severity,
        message: f.message,
        code: f.code,
        fixHint: f.fixHint,
      })),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    Logger.error("Agent: lint exception", { msg });
    return {
      ok: false,
      errorCount: 1,
      warningCount: 0,
      infoCount: 0,
      findings: [{ severity: "error", message: `Lint failed: ${msg}` }],
    };
  }
}

export async function autoFixLint(compPath: string, findings: LintFinding[]): Promise<string | null> {
  let html = await Bun.file(compPath).text();
  const fixes: string[] = [];

  for (const finding of findings) {
    if (finding.severity !== "error" && finding.code !== "gsap_studio_edit_blocked") continue;

    if (finding.code === "gsap_studio_edit_blocked") {
      const fixed = await fixGsapStudioEditBlocked(compPath, html);
      if (fixed) {
        html = fixed.newHtml;
        fixes.push(fixed.applied.join(", "));
      }
      continue;
    }

    if (finding.message.includes("window.__timelines") && !html.includes("window.__timelines")) {
      const compIdMatch = html.match(/data-composition-id="([^"]+)"/);
      const durMatch = html.match(/data-duration="([^"]+)"/);
      if (compIdMatch && durMatch) {
        const compId = compIdMatch[1];
        const duration = durMatch[1];
        const timelineScript = `<script>\n      window.__timelines = window.__timelines || {};\n      const tl = gsap.timeline({ paused: true });\n      tl.to({}, { duration: ${duration} });\n      window.__timelines["${compId}"] = tl;\n    </script>`;
        html = html.replace("</body>", `${timelineScript}\n  </body>`);
        fixes.push("added window.__timelines registration");
      }
    }

    if (finding.message.includes("data-composition-id") && !html.includes("data-composition-id=")) {
      html = html.replace(/<div\s+id="stage"/, '<div id="stage" data-composition-id="composition"');
      fixes.push("added data-composition-id");
    }

    if (finding.message.includes("data-width") && !html.includes("data-width=")) {
      html = html.replace(/<div\s+id="stage"/, '<div id="stage" data-width="1920" data-height="1080"');
      fixes.push("added data-width/data-height");
    }
  }

  if (fixes.length > 0) {
    await Bun.write(compPath, html);
    Logger.info("Agent: auto-fixed lint issues", { fixes });
    return fixes.join(", ");
  }
  return null;
}

async function fixGsapStudioEditBlocked(
  compPath: string,
  html: string,
): Promise<{ newHtml: string; applied: string[] } | null> {
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  let workHtml = html;
  const applied: string[] = [];
  let anyConverted = false;

  while ((m = scriptRe.exec(html)) !== null) {
    const scriptContent = m[1] ?? "";
    if (!/gsap\.timeline/.test(scriptContent)) continue;
    if (!/window\.__timelines\[/.test(scriptContent)) continue;
    const fromToCalls = parseGsapFromToCalls(scriptContent);
    if (fromToCalls.length === 0) continue;

    let newScript = scriptContent;
    const keyframesBlocks: string[] = [];
    const elementUpdates: { selector: string; animationDecl: string }[] = [];

    for (const tween of fromToCalls) {
      const css = gsapFromToToCss(tween);
      if (!css) continue;
      const callRe = new RegExp(
        `\\.fromTo\\s*\\(\\s*["']${tween.selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][\\s\\S]*?\\)\\s*;?`,
        "g",
      );
      newScript = newScript.replace(callRe, "");
      keyframesBlocks.push(css.keyframes);
      elementUpdates.push({ selector: css.selector, animationDecl: css.animationDecl });
      applied.push(`converted ${tween.selector} fromTo to ${css.name}`);
      anyConverted = true;
    }

    if (!anyConverted) continue;
    workHtml = workHtml.replace(scriptContent, newScript);
    if (keyframesBlocks.length > 0) {
      const styleBlock = `\n    <style>\n      ${keyframesBlocks.join("\n      ")}\n    </style>\n  </head>`;
      workHtml = workHtml.replace("</head>", styleBlock);
    }
    for (const { selector, animationDecl } of elementUpdates) {
      const id = selector.slice(1);
      const elRe = new RegExp(`(<[^>]*\\bid="${id}"\\b[^>]*?)\\s*style="([^"]*)"`, "g");
      workHtml = workHtml.replace(elRe, (full, before: string, style: string) => {
        const isClip = /class="[^"]*clip[^"]*"/.test(before);
        const finalStyle = isClip
          ? `style="${style.replace(/transform\s*:[^;]+;?/g, "").replace(/opacity\s*:\s*0\s*;?/g, "").trim()} ${animationDecl};".trim()`.replace(/\s+;/g, ";")
          : `style="${style} ${animationDecl};"`;
        return finalStyle;
      });
    }
  }

  if (!anyConverted) return null;
  await Bun.write(compPath, workHtml);
  return { newHtml: workHtml, applied };
}

async function loadAllSkills(): Promise<string> {
  const skillsDir = path.join(import.meta.dirname, "skills");

  const skillPaths: string[] = [
    "db-integration.md",
    "composition-editing.md",
    "hyperframes-core/SKILL.md",
    "hyperframes-core/data-attributes.md",
    "hyperframes-core/tracks-and-clips.md",
    "hyperframes-core/determinism-rules.md",
  ];

  const parts: string[] = [];

  for (const relPath of skillPaths) {
    const fullPath = path.join(skillsDir, relPath);
    try {
      const file = Bun.file(fullPath);
      if (await file.exists()) {
        const content = await file.text();
        parts.push(`=== ${relPath} ===\n${content}`);
      }
    } catch {
    }
  }

  return parts.join("\n\n");
}

export async function initAgent(): Promise<void> {
  if (loaded) return;
  const skills = await loadAllSkills();
  systemPrompt = `You are an AI video editing assistant integrated into HyperCut, a video editing application. You help users edit their video compositions by modifying HTML composition files, searching their media library, and managing suggestions.

Available Skills (use these to guide your edits):
${skills}

CRITICAL RULES:
1. Always call read_composition first before editing - never assume you know the current state.
2. After making changes, always call write_composition to persist them. The UI auto-reloads.
3. write_composition automatically lints and auto-fixes common issues. If lint errors remain, fix them and call write_composition again.
4. When searching media, present the results to the user with clear descriptions.
5. For suggestions: get_suggestions lists AI-generated edits; ask user which they want before applying.
6. Be concise in your responses but thorough in your edits.
7. The source video is at track-index 0. Overlays go on tracks 1+.
8. Preserve existing elements in the composition unless the user asks to remove them.
9. If you need more information about a tool, ask the user. Don't guess.
10. ANIMATION RULE: When animating overlay elements (images, text, divs), prefer CSS @keyframes animations defined in <style>. Do NOT use tl.fromTo / tl.to / tl.set targeting clip elements — the linter flags this as gsap_studio_edit_blocked and Studio cannot write back edits. Pattern: define @keyframes <name> { from {...} to {...} } in <style>, then add animation: <name> <dur>s <ease> <delay>s 1 both; to the element's inline style. The window.__timelines timeline must remain tween-free except for the duration marker tl.to({}, { duration: <total> }).`;

  loaded = true;
}

function createTools(jobId: string, compositionEditedRef: { current: boolean }) {
  return [
    tool({
      name: "read_composition",
      description: "Read the current composition HTML for this job. Always call this first before making edits.",
      parameters: {
        jobId: z.string().describe("The job ID"),
      },
      implementation: async () => {
        const outputDir = Bun.env.OUTPUT_DIR;
        if (!outputDir) return "Error: OUTPUT_DIR not configured";
        const compPath = `${outputDir}/hypercut-${jobId}/index.html`;
        const file = Bun.file(compPath);
        if (!(await file.exists())) return "Error: composition not found. Generate it first.";
        return await file.text();
      },
    }),

    tool({
      name: "write_composition",
      description: "Write a new composition HTML. This replaces the entire composition. Call this after editing. Automatically lints after writing — if lint errors are found, they are returned and the composition is auto-fixed when possible.",
      parameters: {
        html: z.string().describe("The full HTML content of the composition"),
      },
      implementation: async (args: { html: string }) => {
        const outputDir = Bun.env.OUTPUT_DIR;
        if (!outputDir) return "Error: OUTPUT_DIR not configured";
        const projectDir = `${outputDir}/hypercut-${jobId}`;
        const compPath = `${projectDir}/index.html`;
        await Bun.write(compPath, args.html);
        compositionEditedRef.current = true;
        Logger.info("Agent: composition written", { jobId });

        const lintResult = await lintComposition(projectDir);
        if (lintResult.errorCount > 0) {
          const fixed = await autoFixLint(compPath, lintResult.findings);
          if (fixed) {
            return `Composition saved. Lint found ${lintResult.errorCount} error(s) — auto-fixed: ${fixed}. Composition is now valid.`;
          }
          return `Composition saved but lint found ${lintResult.errorCount} error(s):\n${lintResult.findings.map(f => `[${f.severity}] ${f.code ?? ""}: ${f.message} — ${f.fixHint ?? f.fix ?? ""}`).join("\n")}\nFix these and call write_composition again.`;
        }
        if (lintResult.warningCount > 0) {
          const fixed = await autoFixLint(compPath, lintResult.findings);
          if (fixed) {
            return `Composition saved. Lint passed with ${lintResult.warningCount} warning(s) — auto-fixed: ${fixed}.`;
          }
          return `Composition saved. Lint passed with ${lintResult.warningCount} warning(s):\n${lintResult.findings.map(f => `[${f.severity}] ${f.code ?? ""}: ${f.message} — ${f.fixHint ?? ""}`).join("\n")}`;
        }
        return "Composition saved successfully. Lint passed. The studio will reload.";
      },
    }),

    tool({
      name: "lint_composition",
      description: "Run the HyperFrames linter on the current composition. Returns errors and warnings with fix suggestions. Always call this after write_composition to verify the composition is valid.",
      parameters: {},
      implementation: async () => {
        const outputDir = Bun.env.OUTPUT_DIR;
        if (!outputDir) return "Error: OUTPUT_DIR not configured";
        const projectDir = `${outputDir}/hypercut-${jobId}`;
        const result = await lintComposition(projectDir);
        if (result.errorCount === 0 && result.warningCount === 0) {
          return "Lint passed. No issues found.";
        }
        return JSON.stringify(result, null, 2);
      },
    }),

    tool({
      name: "search_media",
      description: "Semantic search of the media library. Returns matching images, videos, and audio files ranked by relevance.",
      parameters: {
        query: z.string().describe("Natural language search query describing the visual/audio content you want"),
        limit: z.number().optional().default(5).describe("Maximum number of results"),
      },
      implementation: async (args: { query: string; limit?: number }) => {
        const results = await Chroma.search(args.query, args.limit ?? 5);
        return JSON.stringify(results);
      },
    }),

    tool({
      name: "get_suggestions",
      description: "Get content suggestions for this job — additional media assets (images/video/text) from the content library that could be added to the composition.",
      parameters: {},
      implementation: async () => {
        const suggestions = await DB.Hypercut.findContentSuggestionsByJob(jobId);
        return JSON.stringify(suggestions);
      },
    }),

    tool({
      name: "accept_suggestion",
      description: "Mark a suggestion as accepted.",
      parameters: {
        suggestionId: z.string().describe("The suggestion ID to accept"),
      },
      implementation: async (args: { suggestionId: string }) => {
        await DB.Hypercut.updateSuggestionStatus(args.suggestionId, "accepted");
        return "Suggestion accepted.";
      },
    }),

    tool({
      name: "reject_suggestion",
      description: "Mark a suggestion as rejected.",
      parameters: {
        suggestionId: z.string().describe("The suggestion ID to reject"),
      },
      implementation: async (args: { suggestionId: string }) => {
        await DB.Hypercut.updateSuggestionStatus(args.suggestionId, "rejected");
        return "Suggestion rejected.";
      },
    }),

    tool({
      name: "get_transcript_words",
      description: "Get transcribed words from autocut suggestions (filler/pause detections). Each entry has word text + start/end timestamps.",
      parameters: {},
      implementation: async () => {
        const suggestions = await DB.Hypercut.findSuggestionsByJob(jobId);
        const words = suggestions
          .filter((s) => s.source_type === "autocut_cut" && s.text_content)
          .map((s) => ({
            word: s.text_content,
            start: s.transcript_anchor_start,
            end: s.transcript_anchor_end,
          }));
        return JSON.stringify(words.length > 0 ? words : "No transcript words available. Use get_suggestions for timing data.");
      },
    }),

    tool({
      name: "get_job_info",
      description: "Get job metadata: resolution, status, original_prompt.",
      parameters: {},
      implementation: async () => {
        const job = await DB.Jobs.findById(jobId);
        if (!job) return "Error: job not found";
        return JSON.stringify({
          id: job.id,
          resolution: job.resolution,
          status: job.status,
          original_prompt: job.original_prompt,
          source_video_path: job.source_video_path,
        });
      },
    }),
  ];
}

type HistoryMsg = { role: "system" | "user" | "assistant"; content: string };

const encoder = new TextEncoder();

const conversations = new Map<string, HistoryMsg[]>();
const MAX_HISTORY = 20;

function getOrCreateConversation(jobId: string): HistoryMsg[] {
  let history = conversations.get(jobId);
  if (!history) {
    history = [{ role: "system", content: systemPrompt }];
    conversations.set(jobId, history);
  }
  return history;
}

function trimHistory(history: HistoryMsg[]): void {
  if (history.length > MAX_HISTORY) {
    const systemMsg = history[0];
    const recent = history.slice(history.length - MAX_HISTORY + 1);
    history.length = 0;
    history.push(systemMsg, ...recent);
  }
}

export namespace AgenticEditor {
  export function clearHistory(jobId: string): void {
    conversations.delete(jobId);
  }

  export async function chatStream(
    jobId: string,
    message: string,
  ): Promise<Response> {
    await initAgent();

    const compositionEditedRef = { current: false };
    const agentTools = createTools(jobId, compositionEditedRef);
    const history: HistoryMsg[] = getOrCreateConversation(jobId);

    history.push({ role: "user", content: message });

    let finalText = "";

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (eventName: string, data: string) => {
          controller.enqueue(encoder.encode(`event: ${eventName}\ndata: ${data}\n\n`));
        };

        try {
          await LLM.model.act(history as ChatLike, agentTools, {
            maxTokens: 10_000,
            onPredictionFragment: (fragment: { content: string; roundIndex: number }) => {
              if (fragment.content) {
                finalText += fragment.content;
                sendEvent("token", JSON.stringify({ text: fragment.content }));
              }
            },
            onMessage: (msg: { toString(): string }) => {
              finalText = msg.toString();
            },
          });

          history.push({ role: "assistant", content: finalText });
          trimHistory(history);

          sendEvent("done", JSON.stringify({
            text: finalText,
            compositionEdited: compositionEditedRef.current,
          }));
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          Logger.error("Agent: chat failed", { jobId, error: msg });
          sendEvent("error", JSON.stringify({ message: msg }));
          sendEvent("done", JSON.stringify({ text: "Error processing message", compositionEdited: compositionEditedRef.current }));
        } finally {
          try { controller.close(); } catch {  }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test src/hypercut/agentic-editor.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hypercut/agentic-editor.ts src/hypercut/agentic-editor.test.ts
git commit -m "feat(hypercut): programmatic lint + autoFix GSAP-to-CSS + system prompt rule"
```

---

## Task 5: API render_job uses renderWithValidation + structured error bodies

**Files:**
- Modify: `src/api/api/hypercut.ts:140-154`

- [ ] **Step 1: Read the current render_job function**

`src/api/api/hypercut.ts` lines 140–154 currently call `HyperCutWorkflow.render` directly and return a generic 500 with `error: message` on failure.

- [ ] **Step 2: Modify render_job to use renderWithValidation**

Replace the body of `render_job` (and add the import) with:

```ts
import { renderWithValidation, RenderValidationError, RenderOutputError } from "../../hypercut/render-orchestrator";

export async function render_job(jobId: string) {
  const outputDir = Bun.env.OUTPUT_DIR;
  if (!outputDir) {
    return Response.json({ error: "OUTPUT_DIR not configured" }, { status: 500 });
  }

  try {
    const outputPath = await renderWithValidation(jobId, outputDir);
    return Response.json({ output_path: outputPath });
  } catch (error) {
    if (error instanceof RenderValidationError) {
      Logger.warn("HyperCut render validation failed", { jobId, findings: error.findings });
      return Response.json({
        error: "Composition validation failed",
        findings: error.findings,
      }, { status: 400 });
    }
    if (error instanceof RenderOutputError) {
      Logger.error("HyperCut render output invalid", { jobId, message: error.message, diagnostics: error.diagnostics });
      return Response.json({
        error: error.message,
        diagnostics: error.diagnostics,
      }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : String(error);
    Logger.error("HyperCut render failed", { jobId, message });
    return Response.json({ error: message }, { status: 500 });
  }
}
```

Keep the existing imports at the top of the file; add the new import near the existing `HyperCutWorkflow` import.

- [ ] **Step 3: Verify typecheck**

```bash
bunx tsc --noEmit
```

Expected: no errors in `src/api/api/hypercut.ts`.

- [ ] **Step 4: Manual smoke test**

```bash
curl -s -X POST http://localhost:3000/jobs/hypercut/019edaa4-31a4-7000-a6e6-20512aec90b0/render | head -c 500
```

Expected: either `{"output_path":"..."}` (200) or `{"error":"Composition validation failed","findings":[...]}` (400) or `{"error":"...","diagnostics":{...}}` (500). No raw ffmpeg stderr.

- [ ] **Step 5: Commit**

```bash
git add src/api/api/hypercut.ts
git commit -m "feat(api): render_job uses renderWithValidation + structured errors"
```

---

## Task 6: Fix the current composition on disk (GSAP → CSS)

**Files:**
- Modify in-place: `/run/media/dennis/ai/comfy-ui/output/hypercut-019edaa4-31a4-7000-a6e6-20512aec90b0/index.html`
- Create: `src/hypercut/fix-composition-gsap-to-css.ts` (reusable one-shot script)

- [ ] **Step 1: Write the fix script**

`src/hypercut/fix-composition-gsap-to-css.ts`:

```ts
import { parseGsapFromToCalls, gsapFromToToCss } from "./gsap-to-css";

async function fixFile(compPath: string): Promise<void> {
  const file = Bun.file(compPath);
  if (!(await file.exists())) {
    console.error(`File not found: ${compPath}`);
    process.exit(1);
  }
  let html = await file.text();
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  let anyConverted = false;
  const keyframesBlocks: string[] = [];
  const elementUpdates: { selector: string; animationDecl: string }[] = [];

  while ((m = scriptRe.exec(html)) !== null) {
    const scriptContent = m[1] ?? "";
    if (!/gsap\.timeline/.test(scriptContent)) continue;
    if (!/window\.__timelines\[/.test(scriptContent)) continue;
    const fromToCalls = parseGsapFromToCalls(scriptContent);
    if (fromToCalls.length === 0) continue;

    let newScript = scriptContent;
    for (const tween of fromToCalls) {
      const css = gsapFromToToCss(tween);
      if (!css) {
        console.warn(`Skipping unsupported tween on ${tween.selector}`);
        continue;
      }
      const callRe = new RegExp(
        `\\.fromTo\\s*\\(\\s*["']${tween.selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][\\s\\S]*?\\)\\s*;?`,
        "g",
      );
      newScript = newScript.replace(callRe, "");
      keyframesBlocks.push(css.keyframes);
      elementUpdates.push({ selector: css.selector, animationDecl: css.animationDecl });
      console.log(`Converted ${tween.selector} → ${css.name}`);
      anyConverted = true;
    }
    if (newScript !== scriptContent) {
      html = html.replace(scriptContent, newScript);
    }
  }

  if (!anyConverted) {
    console.log("No convertible GSAP fromTo tweens found.");
    return;
  }

  if (keyframesBlocks.length > 0) {
    const styleBlock = `\n    <style>\n      ${keyframesBlocks.join("\n      ")}\n    </style>\n  </head>`;
    html = html.replace("</head>", styleBlock);
  }
  for (const { selector, animationDecl } of elementUpdates) {
    const id = selector.slice(1);
    const elRe = new RegExp(`(<[^>]*\\bid="${id}"\\b[^>]*?)\\s*style="([^"]*)"`, "g");
    html = html.replace(elRe, (full, before: string, style: string) => {
      const cleanedStyle = style
        .replace(/transform\s*:[^;]+;?/g, "")
        .replace(/opacity\s*:\s*0\s*;?/g, "")
        .trim()
        .replace(/\s+/g, " ");
      const finalStyle = `${cleanedStyle} ${animationDecl};`.replace(/\s+;/g, ";").trim();
      return full.replace(`style="${style}"`, `style="${finalStyle}"`);
    });
  }

  await Bun.write(compPath, html);
  console.log(`Wrote fixed composition to ${compPath}`);
}

const compPath = process.argv[2];
if (!compPath) {
  console.error("Usage: bun src/hypercut/fix-composition-gsap-to-css.ts <path-to-index.html>");
  process.exit(1);
}
fixFile(compPath).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the fix script on the current composition**

```bash
bun src/hypercut/fix-composition-gsap-to-css.ts /run/media/dennis/ai/comfy-ui/output/hypercut-019edaa4-31a4-7000-a6e6-20512aec90b0/index.html
```

Expected output: `Converted #sugg-019edaa4 → sugg-019edaa4-anim` + `Wrote fixed composition to ...`.

- [ ] **Step 3: Verify the composition lints clean**

```bash
bunx --bun hyperframes lint --json /run/media/dennis/ai/comfy-ui/output/hypercut-019edaa4-31a4-7000-a6e6-20512aec90b0
```

Expected: `errorCount: 0, warningCount: 0`.

- [ ] **Step 4: Verify the composition file is structurally valid**

```bash
bun src/hypercut/composition-validator.ts /run/media/dennis/ai/comfy-ui/output/hypercut-019edaa4-31a4-7000-a6e6-20512aec90b0/index.html
```

(Or just read the file and confirm: `@keyframes sugg-019edaa4-anim` present, `tl.fromTo("#sugg-019edaa4"` absent, `window.__timelines["hypercut-019edaa4-..."] = tl` still present, `data-composition-id/data-width/data-height/data-duration` still on `#stage`.)

- [ ] **Step 5: Commit**

```bash
git add src/hypercut/fix-composition-gsap-to-css.ts
git commit -m "feat(hypercut): add reusable GSAP-to-CSS composition fixer script"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full hypercut test suite**

```bash
bun test src/hypercut/
```

Expected: all tests PASS, 0 fail.

- [ ] **Step 2: Run typecheck**

```bash
bunx tsc --noEmit
```

Expected: no errors in `src/hypercut/` or `src/api/api/hypercut.ts`. Pre-existing errors in `migrations/` (unrelated `any` types) are out of scope.

- [ ] **Step 3: Run eslint on touched files**

```bash
bun run lint -- src/hypercut/gsap-to-css.ts src/hypercut/composition-validator.ts src/hypercut/render-orchestrator.ts src/hypercut/agentic-editor.ts src/hypercut/fix-composition-gsap-to-css.ts src/api/api/hypercut.ts
```

Expected: 0 errors on these files.

- [ ] **Step 4: Run the live render endpoint**

```bash
curl -s -X POST http://localhost:3000/jobs/hypercut/019edaa4-31a4-7000-a6e6-20512aec90b0/render -w "\nHTTP %{http_code}\n" | head -c 800
```

Expected: either 200 with `output_path`, or 400/500 with structured `findings` or `diagnostics`. The response must NOT contain raw ffmpeg stderr.

- [ ] **Step 5: Run the live lint endpoint (if exposed via the preview manager) or hyperframes CLI**

```bash
bunx --bun hyperframes lint --json /run/media/dennis/ai/comfy-ui/output/hypercut-019edaa4-31a4-7000-a6e6-20512aec90b0
```

Expected: `errorCount: 0, warningCount: 0` (or only pre-existing warnings unrelated to the fix).

- [ ] **Step 6: Update memory**

```bash
opencode memory add "hypercut render pipeline now wrapped with renderWithValidation: pre-render validation (structural + lintCompositionHtml) + post-render diagnostics (work dir inspection). Agentic editor uses programmatic lintCompositionHtml instead of spawning npx hyperframes lint on projectDir (avoids scanning renders/ build artifacts). autoFixLint converts gsap_studio_edit_blocked warnings to CSS @keyframes. fix-composition-gsap-to-css.ts is a reusable one-shot script for converting existing compositions."
```

- [ ] **Step 7: Commit final state (if anything changed)**

```bash
git status --short
git add -A && git commit -m "chore: final verification pass" 2>/dev/null || echo "nothing to commit"
```

---

## Self-Review Notes

- Spec coverage: every section of the design spec maps to at least one task. The `gsap-to-css.ts` converter (Task 1) backs both the autoFixLint path (Task 4) and the one-shot fix script (Task 6). The validator (Task 2) backs both the agentic editor (Task 4) and the render orchestrator (Task 3). The orchestrator (Task 3) backs the API change (Task 5).
- No placeholder text. Every step has complete code.
- Type consistency: `LintFinding` interface in `agentic-editor.ts` now includes `code?: string` and `fixHint?: string` (was: only `severity/message/file/fix`). The validator's `CompositionValidationFinding` is a subset shape. The autoFixLint signature is unchanged (`(compPath, findings) => Promise<string | null>`), so existing call sites still work.
- The render orchestrator's tests mock `HyperCutWorkflow.render` by directly reassigning the namespace export. This is brittle but matches what Bun:test supports without a dependency-injection refactor. If the test flakes, swap to dependency injection in a follow-up.
