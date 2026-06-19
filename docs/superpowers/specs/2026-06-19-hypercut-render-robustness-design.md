# Hypercut Render Robustness + Lint Fixes — Design

## 2026-06-19

## Problem

### Symptom A — FFmpeg render failure

Job `019edaa4-31a4-7000-a6e6-20512aec90b0` render at
`/run/media/dennis/ai/comfy-ui/output/hypercut-019edaa4-.../renders/work-7cb0a3e5-.../`
failed with:

```
Could not find codec parameters for stream 0
(Video: mjpeg, none(bt470bg/unknown/unknown)): unspecified size
Output file does not contain any stream
```

### Root cause (verified on disk)

The `@hyperframes/producer` render pipeline has 6 stages:
1. compile → writes `compiled/index.html`
2. probe (browser-driven duration discovery)
3. extract videos → writes `compiled/__hyperframes_video_frames/<id>/`
4. audio
5. capture → writes `captured-frames/frame_NNNNNN.jpg`
6. encode → ffmpeg combines captured frames

Inspection of the failed work dir shows:

| Artifact | State |
|---|---|
| `compiled/index.html` | **0 bytes (empty)** |
| `compiled/__hyperframes_video_frames/seg-0..6/` | populated (545+ frames each) |
| `captured-frames/` | **0 files** |
| `downloads/_remote_media/` | empty |
| `capture-calibration/` | empty |
| `meta.json` | `{"status":"failed"}` |

Stage 3 (extract videos) succeeded — frame subdirs are full.
Stage 5 (capture) produced 0 frames because Chrome had no DOM to render
(`compiled/index.html` was empty). Stage 6 then ran ffmpeg against an
empty `captured-frames/` glob → "no streams" error.

The compile stage of `@hyperframes/producer` returned an empty
`compiled.html` string. The exact upstream cause inside the compiler
bundle cannot be deterministically reproduced without re-running against
the source HTML at render time (the composition has since been rewritten
by the agentic editor). Plausible triggers: a transient CDN fetch
failure in `inlineExternalScripts` (jsdelivr GSAP), a parser crash on a
specific HTML shape, or a remote-media localization failure on
`http://localhost:3000/assets/...` URLs.

The fix target is **not** the compiler internals (out of our control —
vendored package). The fix target is **our pipeline wrapper**: detect
compile failure before ffmpeg runs, surface meaningful errors, and
prevent the cryptic downstream error.

### Symptom B — HyperFrames lint errors

Reported:

1. `[warning] gsap_studio_edit_blocked` on `index.html` — GSAP tweens
   target `#sugg-019edaa4` in a registered timeline. Studio cannot
   save drag/resize edits to these elements.
2. `[error] Root composition is missing data-composition-id` on
   `renders/work-.../compiled/index.html`
3. `[error] Root composition is missing data-width or data-height` on
   same file
4. `[error] Missing window.__timelines registration` on same file

Errors 2–4 are downstream of the empty `compiled/index.html`. Once the
empty-file condition is detected and the failed render dir is cleaned
up (or never linted), they vanish.

The warning is real and orthogonal: the agentic editor wrote a
`tl.fromTo("#sugg-019edaa4", { scale: 0.3, rotation: -15, opacity: 0 }, {...})`
tween targeting a clip element, then registered the timeline. The
linter correctly flags this — Studio cannot write back drag edits to
GSAP-owned elements. The composition is not Studio-edited, but the
warning is correct signal: GSAP ownership of clip positions is a
category that bites future editing.

## Goals

1. **Render pipeline robustness** — detect failure modes early and
   surface actionable errors instead of letting ffmpeg produce cryptic
   "no streams" messages.
2. **Lint integration improvement** — stop linting build artifacts in
   `renders/`; lint source HTML directly via the `@hyperframes/core`
   programmatic API.
3. **Lint warning fix** — replace GSAP `fromTo` on clip elements with
   CSS `@keyframes` animations so the `gsap_studio_edit_blocked`
   warning no longer fires; teach the agentic editor the same pattern.
4. **Test coverage** — pin the above behavior with `bun:test` tests.

## Non-goals

- Patching `@hyperframes/producer` internals (vendored).
- Replacing the render pipeline with a different renderer.
- Removing GSAP entirely (the timeline registration is still required
  for HF runtime duration discovery — only GSAP mutation tweens on
  clip elements are removed).
- Solving every agentic-editor output quality issue — only the lint
  warning pattern is in scope.

## Architecture

### Source HTML contract (already met by `generateStandaloneHtml`)

```html
<div id="stage"
  data-composition-id="hypercut-<jobId>"
  data-start="0"
  data-width="1920"
  data-height="1080"
  data-duration="<total>">
  ...clips...
</div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  // NO tl.to/from/fromTo/set targeting clip elements
  tl.to({}, { duration: <total> });
  window.__timelines["hypercut-<jobId>"] = tl;
</script>
```

The contract: the registered timeline exists for HF runtime duration
discovery only. Element animations belong in CSS `@keyframes` applied
via `animation:` shorthand on the element (or a class), so the GSAP
timeline has no mutation targets.

### Change set

#### 1. New module: `src/hypercut/composition-validator.ts`

Pure functions, fully testable, no I/O dependencies beyond `Bun.file`.

Exports:

```ts
export interface CompositionValidationFinding {
  code: string;
  severity: "error" | "warning";
  message: string;
  fixHint?: string;
}

export interface CompositionValidationResult {
  ok: boolean;               // errorCount === 0
  errorCount: number;
  warningCount: number;
  findings: CompositionValidationFinding[];
  compositionId: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
}

export async function validateCompositionHtml(
  html: string,
): Promise<CompositionValidationResult>;

export async function validateCompositionFile(
  compPath: string,
): Promise<CompositionValidationResult>;

export async function lintCompositionHtml(
  html: string,
): Promise<CompositionValidationResult>;
```

`validateCompositionHtml` performs the static structural checks:

- `data-composition-id` present on root `<div data-composition-id>` (not `<html>`)
- `data-width` and `data-height` present and numeric
- `data-duration` present and numeric
- `window.__timelines["<id>"]` registration present, with id matching root
- `gsap.timeline` script loaded (via `<script src=...gsap...>` or inlined)
- At least one `class="clip"` element with `data-start` and `data-duration`

`lintCompositionHtml` runs `lintHyperframeHtml` from `@hyperframes/core`
on the HTML string directly (no filesystem scan, no `renders/`
contamination). Returns the same shape, with the lint findings merged.

#### 2. New module: `src/hypercut/gsap-to-css.ts`

Pure function. Converts a GSAP `tl.fromTo("#id", {from}, {to, duration, ease})`
call into a CSS `@keyframes` block + `animation:` shorthand.

```ts
export interface GsapTween {
  selector: string;          // "#id" only — class selectors rejected
  fromProps: Record<string, number | string>;
  toProps: Record<string, number | string>;
  duration: number;
  ease?: string;
  position?: number;         // timeline insertion time
}

export interface CssAnimation {
  name: string;              // e.g. "sugg-019edaa4-anim"
  keyframes: string;         // "@keyframes <name> { from {...} to {...} }"
  animationDecl: string;     // "animation: <name> <dur>s <ease> <delay>s ... ;"
  selector: string;          // "#id"
}

export function gsapFromToToCss(
  tween: GsapTween,
): CssAnimation | null;
```

Supported property mappings (initial cut):

| GSAP | CSS |
|---|---|
| `opacity` | `opacity` |
| `scale` | `transform: scale()` (combined with rotation) |
| `rotation` | `transform: rotate()` (combined with scale) |
| `x` / `y` | `transform: translate()` (combined) |
| `backgroundColor` | `background-color` |

Unsupported properties → return `null` (caller leaves the GSAP tween
alone; the warning persists but no data loss).

`ease` is mapped to a CSS `animation-timing-function` keyword (`power2.out`
→ `ease-out`, `power3.in` → `ease-in`, `power2.inOut` → `ease-in-out`,
`sine.out` → `ease-out`, default → `ease-out`).

`position` (timeline insertion time, in seconds) becomes
`animation-delay: <position>s`.

#### 3. New module: `src/hypercut/render-orchestrator.ts`

Wraps `HyperCutWorkflow.render` with pre-render validation, post-render
failure detection, and work-dir cleanup.

```ts
export interface RenderDiagnostics {
  workDir: string | null;
  compiledHtmlExists: boolean;
  compiledHtmlBytes: number;
  capturedFramesCount: number;
  outputExists: boolean;
  outputBytes: number;
}

export async function describeRenderDiagnostics(
  projectDir: string,
): Promise<RenderDiagnostics>;

export class RenderValidationError extends Error {
  readonly findings: CompositionValidationFinding[];
  constructor(findings: CompositionValidationFinding[]);
}

export class RenderOutputError extends Error {
  readonly diagnostics: RenderDiagnostics;
  constructor(message: string, diagnostics: RenderDiagnostics);
}

export async function renderWithValidation(
  jobId: string,
  outputDir: string,
): Promise<string>;
```

`renderWithValidation`:

1. Read `${outputDir}/hypercut-${jobId}/index.html`. Throw
   `RenderValidationError` if missing.
2. Run `validateCompositionFile` + `lintCompositionHtml` on the source.
   If any error-severity finding: throw `RenderValidationError` with the
   findings. Warnings are allowed (the render still proceeds).
3. Call `HyperCutWorkflow.render(jobId, outputDir)`.
4. Verify output file exists and is non-trivially sized (>1KB — a
   valid mp4 header alone is more than that).
5. If output missing or too small: collect `RenderDiagnostics` from the
   newest `renders/work-*` dir and throw `RenderOutputError` with a
   descriptive message:
   - "Compiled HTML is empty (0 bytes) — compile stage failed"
   - "Captured 0 frames — capture stage failed; compiled HTML was <N> bytes"
   - "Output file is <N> bytes — encode stage produced invalid output"
6. On success: return the output path.

#### 4. Update `src/hypercut/agentic-editor.ts`

- Replace `lintComposition(projectDir)` (spawns `npx hyperframes lint` on
  the project dir, which scans `renders/`) with a call to
  `lintCompositionHtml` on the source HTML string only.
- Extend `autoFixLint` to handle `gsap_studio_edit_blocked`:
  - Parse the GSAP `tl.fromTo("#id", ...)` calls in the HTML
  - For each, attempt `gsapFromToToCss` conversion
  - On success: remove the GSAP call, inject the `@keyframes` into
    `<style>`, and add the `animation:` shorthand to the element's
    inline `style` attribute
  - On failure (unsupported props): leave the GSAP call alone, surface
    the warning to the LLM
- Update the system prompt with an explicit rule: "When animating
  overlay elements (images, text, divs), prefer CSS `@keyframes`
  animations defined in `<style>`. Do NOT use `tl.fromTo`/`tl.to`/
  `tl.set` targeting clip elements — the linter flags this as
  `gsap_studio_edit_blocked` and Studio cannot write back edits."

#### 5. Update `src/api/api/hypercut.ts`

- `render_job(jobId)`: call `renderWithValidation` instead of
  `HyperCutWorkflow.render` directly. Map `RenderValidationError` and
  `RenderOutputError` to HTTP 400/500 with structured JSON bodies
  including the findings/diagnostics, so the UI can display them.

#### 6. Update `src/hypercut/generate-standalone-html.ts`

No structural change. The generator already produces clean HTML that
lints with 0 errors 0 warnings. Add one defensive guard: if `elements`
is empty, still emit a valid composition with a 1s blank timeline
(currently `totalDuration` would be 0, which the linter accepts but
the renderer cannot capture). This is a separate edge case but cheap
to harden.

#### 7. Update `src/hypercut/hypercut-workflow.ts`

`HyperCutWorkflow.render` stays as the low-level call.
`renderWithValidation` wraps it. No signature change to `render` —
backwards compat for any direct callers.

#### 8. Fix the current composition on disk

The current `/run/media/dennis/ai/comfy-ui/output/hypercut-019edaa4-.../index.html`
has the `tl.fromTo("#sugg-019edaa4", ...)` warning. We will manually
rewrite it to use CSS `@keyframes` for the suggestion overlay
animation. This is a one-shot fix to the existing file, not code — but
it's the deliverable the user asked for ("Fix these HyperFrames lint
issues"). A small script `src/hypercut/fix-existing-composition.ts`
(reusable, idempotent) will do the conversion for any composition
file passed via CLI arg, and the current job's file will be fixed by
invoking it once.

Actually — rethinking: the user's primary complaint is the lint errors
on the `renders/work-.../compiled/index.html` (which are downstream of
the empty-file bug). Fixing the warning is secondary. The cheapest
path to "no lint errors" for the current job:

1. Run `renderWithValidation` on the current composition — it will
   pass (source has 0 errors, 1 warning).
2. The new render will produce a non-empty `compiled/index.html`.
3. The failed `work-7cb0a3e5-...` dir should be deleted (or the
   `renders/` dir should be excluded from lint — which we do via the
   programmatic API switch).
4. The `gsap_studio_edit_blocked` warning on `index.html` is then
   fixed by the autoFixLint path or by the manual rewrite.

So the "fix the current composition" step is: convert the existing
GSAP fromTo to CSS keyframes in-place. We'll do this via the same
`gsapFromToToCss` function — operate on the file, write the result
back. This is a one-time operation but the function is reusable.

### Data flow

```
HTTP POST /jobs/hypercut/:job_id/render
  ↓
api/hypercut.ts render_job
  ↓
render-orchestrator.ts renderWithValidation
  ├─ validateCompositionFile (structural)
  ├─ lintCompositionHtml (programmatic, source HTML only)
  ├─ if errors → RenderValidationError → HTTP 400
  ├─ HyperCutWorkflow.render
  ├─ verify output exists & >1KB
  ├─ if not → describeRenderDiagnostics → RenderOutputError → HTTP 500
  └─ return path → HTTP 200
```

### Agentic editor lint flow

```
LLM calls write_composition({html})
  ↓
agentic-editor.ts write_composition
  ├─ Bun.write(compPath, html)
  ├─ lintCompositionHtml(html)           ← was: spawn npx lint on projectDir
  ├─ if errors → autoFixLint(compPath, findings)
  │    ├─ existing fixes (missing attrs, missing timelines)
  │    └─ new: gsap_studio_edit_blocked → gsapFromToToCss conversion
  └─ return lint result to LLM
```

## Testing

`bun:test` files added:

- `src/hypercut/composition-validator.test.ts`
  - valid HTML → ok=true, 0 errors
  - missing data-composition-id → 1 error
  - missing data-width → 1 error
  - missing window.__timelines → 1 error
  - id mismatch between root and timeline key → 1 error
  - gsap_studio_edit_blocked warning detected via lintCompositionHtml

- `src/hypercut/gsap-to-css.test.ts`
  - opacity+scale+rotation fromTo → keyframes with transform+opacity
  - unsupported prop (e.g. filter) → null
  - ease power2.out → ease-out
  - position 1.5 → animation-delay 1.5s
  - selector without `#` → null

- `src/hypercut/render-orchestrator.test.ts`
  - missing source composition → RenderValidationError
  - composition with lint errors → RenderValidationError with findings
  - composition with only warnings → proceeds to render
  - successful render → returns path (mock HyperCutWorkflow.render)
  - render produces empty output → RenderOutputError with diagnostics
  - describeRenderDiagnostics reads work dir correctly

- `src/hypercut/agentic-editor.test.ts`
  - autoFixLint converts gsap fromTo to CSS keyframes
  - autoFixLint leaves unsupported GSAP tweens alone
  - lintCompositionHtml excludes renders/ (regression test)

## Verification

After implementation:

1. `bun test src/hypercut/` — all green.
2. `bunx tsc --noEmit` — typecheck clean.
3. `bun run lint` — eslint clean on touched files.
4. Manual: `curl -X POST http://localhost:3000/jobs/hypercut/019edaa4-31a4-7000-a6e6-20512aec90b0/render` → either succeeds (200 with output_path) or fails with structured error (400/500 with findings/diagnostics). No more cryptic ffmpeg stderr in the response body.
5. Manual: `bunx hyperframes lint --json /run/media/dennis/ai/comfy-ui/output/hypercut-019edaa4-...` → 0 errors, 0 warnings after the GSAP-to-CSS conversion.
6. The failed `renders/work-7cb0a3e5-...` dir is left in place as evidence but is no longer linted by our pipeline (the programmatic API doesn't scan it).

## Risks

- **GSAP-to-CSS conversion is lossy** for complex tweens. Mitigation:
  the converter returns `null` for unsupported properties; the GSAP
  tween is preserved and the warning persists. The LLM is told to use
  CSS animations in the first place, so the converter is a safety net,
  not the primary path.
- **`@hyperframes/core` API stability**. `lintHyperframeHtml` is
  exported from the package's public `dist/index.d.ts`. Pinned to
  `0.6.99` in `package.json`. If the API changes on upgrade, tests
  will catch it.
- **Render still might fail for compiler-internal reasons**. The
  wrapper detects the failure and surfaces diagnostics, but cannot
  fix the underlying compiler bug. That's an acceptable boundary —
  the user gets an actionable error instead of a cryptic one.
- **`describeRenderDiagnostics` reads the newest `renders/work-*`
  dir**. If multiple renders ran in parallel for the same job, this
  could pick the wrong one. Mitigation: render is single-slot per
  job (no parallel renders for the same job in current code).

## Out of scope (explicit)

- Re-encoding the source video to fix sparse keyframes (compiler
  already warns about this).
- Replacing the HF producer with a custom renderer.
- Migrating the agentic editor to a different LLM/tool-calling lib.
- Cleaning up old failed render dirs automatically (the user can
  delete `renders/work-7cb0a3e5-...` manually; our lint change makes
  this optional).
