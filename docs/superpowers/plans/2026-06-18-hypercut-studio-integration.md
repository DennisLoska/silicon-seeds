# HyperCut Studio Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken HyperCut timeline by replacing `generateHyperframesHtml()` with a standalone composition generator, fixing composition path mismatches, and cleaning up dead code — so `npx hyperframes preview` serves a working Studio UI with drag/trim timeline editing and agent chat hot-reload.

**Architecture:** `npx hyperframes preview` subprocess (already in `preview-manager.ts`) serves the full Studio UI in an iframe. A new `generateStandaloneHtml()` function produces composition HTML in the correct standalone contract format (root `#stage` with `data-composition-id`/`data-start`/`data-width`/`data-height`/`data-duration`, clips with `class="clip"`/`data-start`/`data-duration`/`data-track-index`, no manual `window.__timelines`). Agent tools and API endpoints all use the same path: `${OUTPUT_DIR}/hypercut-${jobId}/index.html`. Dead code removed.

**Tech Stack:** Bun, Hono JSX, HTMX/SSE, `@hyperframes/core` (types only), `@hyperframes/producer` (render), `npx hyperframes` CLI (preview subprocess), DaisyUI, Zod

---

## Task 1: Create `generateStandaloneHtml()` function

**Files:**
- Create: `src/hypercut/generate-standalone-html.ts`
- Create: `src/hypercut/generate-standalone-html.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/hypercut/generate-standalone-html.test.ts
import { describe, it, expect } from "bun:test";
import { generateStandaloneHtml } from "./generate-standalone-html";
import type { TimelineMediaElement } from "@hyperframes/core";

describe("generateStandaloneHtml", () => {
  const elements: TimelineMediaElement[] = [
    {
      id: "seg-0",
      type: "video",
      name: "Segment 1",
      startTime: 0,
      duration: 5.2,
      zIndex: 0,
      src: "source_test.mp4",
      mediaStartTime: 0,
      sourceDuration: 5.2,
    },
    {
      id: "seg-1",
      type: "video",
      name: "[FILLER] um",
      startTime: 5.2,
      duration: 3.1,
      zIndex: 0,
      src: "source_test.mp4",
      mediaStartTime: 5.2,
      sourceDuration: 3.1,
    },
  ];

  it("produces valid HTML with data-composition-id on #stage root", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "landscape",
      sourceVideoFilename: "source_test.mp4",
    });

    expect(html).toContain('id="stage"');
    expect(html).toContain('data-composition-id="hypercut-test"');
    expect(html).toContain('data-start="0"');
    expect(html).toContain('data-width="1920"');
    expect(html).toContain('data-height="1080"');
    expect(html).toContain('data-duration="8.3"');
  });

  it("does NOT put data-composition-id on <html>", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "landscape",
      sourceVideoFilename: "source_test.mp4",
    });

    expect(html).not.toMatch(/<html[^>]*data-composition-id/);
  });

  it("emits class=clip on each video element", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "landscape",
      sourceVideoFilename: "source_test.mp4",
    });

    expect(html).toContain('class="clip"');
    expect(html).toContain('id="seg-0"');
    expect(html).toContain('id="seg-1"');
  });

  it("emits data-start, data-duration, data-track-index on clips", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "landscape",
      sourceVideoFilename: "source_test.mp4",
    });

    expect(html).toContain('data-start="0" data-duration="5.2" data-track-index="0"');
    expect(html).toContain('data-start="5.2" data-duration="3.1" data-track-index="0"');
  });

  it("emits data-media-start for media offset", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "landscape",
      sourceVideoFilename: "source_test.mp4",
    });

    expect(html).toContain('data-media-start="0"');
    expect(html).toContain('data-media-start="5.2"');
  });

  it("emits data-name with clip label", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "landscape",
      sourceVideoFilename: "source_test.mp4",
    });

    expect(html).toContain('data-name="Segment 1"');
    expect(html).toContain('data-name="[FILLER] um"');
  });

  it("does NOT include window.__timelines script", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "landscape",
      sourceVideoFilename: "source_test.mp4",
    });

    expect(html).not.toContain("__timelines");
  });

  it("clips are direct children of #stage (no wrapper div)", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "landscape",
      sourceVideoFilename: "source_test.mp4",
    });

    // Extract the #stage block and verify clips are direct children
    const stageMatch = html.match(/<div id="stage"[^>]*>([\s\S]*?)<\/div>\s*<\/body>/);
    expect(stageMatch).toBeTruthy();
    const stageContent = stageMatch![1].trim();
    // Each clip should be a <video> directly inside #stage
    expect(stageContent).toContain('<video id="seg-0"');
    expect(stageContent).toContain('<video id="seg-1"');
    // No wrapper div around the videos
    expect(stageContent).not.toMatch(/<div[^>]*>\s*<video/);
  });

  it("supports portrait resolution", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "portrait",
      sourceVideoFilename: "source_test.mp4",
    });

    expect(html).toContain('data-width="1080"');
    expect(html).toContain('data-height="1920"');
  });

  it("supports square resolution", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "square",
      sourceVideoFilename: "source_test.mp4",
    });

    expect(html).toContain('data-width="1080"');
    expect(html).toContain('data-height="1080"');
  });

  it("includes muted and playsinline on video elements", () => {
    const html = generateStandaloneHtml(elements, 8.3, {
      compositionId: "hypercut-test",
      resolution: "landscape",
      sourceVideoFilename: "source_test.mp4",
    });

    expect(html).toContain("muted");
    expect(html).toContain("playsinline");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/hypercut/generate-standalone-html.test.ts`
Expected: FAIL with "Cannot find module './generate-standalone-html'"

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/hypercut/generate-standalone-html.ts
import type { TimelineMediaElement } from "@hyperframes/core";

export interface GenerateStandaloneHtmlOptions {
  compositionId: string;
  resolution: "landscape" | "portrait" | "square";
  sourceVideoFilename: string;
}

const RESOLUTION_DIMS: Record<string, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

export function generateStandaloneHtml(
  elements: TimelineMediaElement[],
  totalDuration: number,
  options: GenerateStandaloneHtmlOptions,
): string {
  const { compositionId, resolution, sourceVideoFilename } = options;
  const { width, height } = RESOLUTION_DIMS[resolution] ?? RESOLUTION_DIMS.landscape;

  const clipsHtml = elements
    .map((el) => {
      const attrs = [
        `id="${el.id}"`,
        `class="clip"`,
        `data-start="${el.startTime}"`,
        `data-duration="${el.duration}"`,
        `data-track-index="${el.zIndex ?? 0}"`,
        `data-media-start="${el.mediaStartTime ?? 0}"`,
        `data-name="${el.name}"`,
      ].join(" ");

      return `      <video ${attrs} src="${sourceVideoFilename}" muted playsinline></video>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>HyperCut ${compositionId}</title>
    <style>
      body { margin: 0; background: #000; }
      #stage { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }
      .clip { position: absolute; inset: 0; }
      video.clip { width: 100%; height: 100%; object-fit: contain; }
    </style>
  </head>
  <body>
    <div id="stage"
      data-composition-id="${compositionId}"
      data-start="0"
      data-width="${width}"
      data-height="${height}"
      data-duration="${totalDuration}"
    >
${clipsHtml}
    </div>
  </body>
</html>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/hypercut/generate-standalone-html.test.ts`
Expected: PASS (all 10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/hypercut/generate-standalone-html.ts src/hypercut/generate-standalone-html.test.ts
git commit -m "feat: add generateStandaloneHtml for hyperframes preview format"
```

---

## Task 2: Wire `generateStandaloneHtml` into `hypercut-workflow.ts`

**Files:**
- Modify: `src/hypercut/hypercut-workflow.ts`

- [ ] **Step 1: Replace `generateHyperframesHtml` import and usage**

In `src/hypercut/hypercut-workflow.ts`:

Remove from imports (line 17):
```typescript
import { generateHyperframesHtml, toFps, type TimelineMediaElement } from "@hyperframes/core";
```

Replace with:
```typescript
import type { TimelineMediaElement } from "@hyperframes/core";
import { generateStandaloneHtml } from "./generate-standalone-html";
```

- [ ] **Step 2: Replace `generateInitialComposition` body**

Replace the entire `generateInitialComposition` function (lines 121-163) with:

```typescript
  export async function generateInitialComposition(
    jobId: string,
    removals: RemovalSpan[] = [],
    duration: number = 10,
  ) {
    const outputDir = Bun.env.OUTPUT_DIR;
    if (!outputDir) return;

    const job = await DB.Jobs.findById(jobId);
    const resolution = (job.resolution ?? "landscape") as "landscape" | "portrait" | "square";

    const projectDir = `${outputDir}/hypercut-${jobId}`;
    const videoFilename = job.source_video_path
      ? `source_${jobId}.mp4`
      : "";
    if (job.source_video_path) {
      await Bun.write(`${projectDir}/${videoFilename}`, Bun.file(job.source_video_path));
    }
    const src = videoFilename;

    const elements = buildChunkedClips(src, jobId, removals, duration);
    const totalDuration = elements.reduce((sum, el) => sum + el.duration, 0);

    const html = generateStandaloneHtml(elements, totalDuration, {
      compositionId: `hypercut-${jobId}`,
      resolution,
      sourceVideoFilename: src,
    });

    await Bun.write(`${projectDir}/index.html`, html);
    Logger.info("HyperCut: composition generated", {
      jobId,
      clips: elements.length,
      duration: totalDuration,
    });
  }
```

Key changes:
- Uses `generateStandaloneHtml()` instead of `generateHyperframesHtml()`
- No `includeScripts: true` (no GSAP timeline needed)
- No string-replace hack for `window.__timelines`
- No `toFps` import (unused)

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 4: Run existing tests**

Run: `bun test`
Expected: PASS (all existing tests + new generate-standalone-html tests)

- [ ] **Step 5: Commit**

```bash
git add src/hypercut/hypercut-workflow.ts
git commit -m "fix: use generateStandaloneHtml for composition, remove timeline hack"
```

---

## Task 3: Fix agent tool paths in `agentic-editor.ts`

**Files:**
- Modify: `src/hypercut/agentic-editor.ts`

- [ ] **Step 1: Fix `read_composition` tool path**

In `src/hypercut/agentic-editor.ts`, find the `read_composition` tool implementation (line 100):

Replace:
```typescript
        const compPath = `${outputDir}/hypercut-${jobId}.html`;
```

With:
```typescript
        const compPath = `${outputDir}/hypercut-${jobId}/index.html`;
```

- [ ] **Step 2: Fix `write_composition` tool path**

In the same file, find the `write_composition` tool implementation (line 116):

Replace:
```typescript
        const compPath = `${outputDir}/hypercut-${jobId}.html`;
```

With:
```typescript
        const compPath = `${outputDir}/hypercut-${jobId}/index.html`;
```

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit**

```bash
git add src/hypercut/agentic-editor.ts
git commit -m "fix: agent tool paths use /index.html not .html"
```

---

## Task 4: Fix `save_composition` path and remove deprecated add-suggestion in `api/hypercut.ts`

**Files:**
- Modify: `src/api/api/hypercut.ts`

- [ ] **Step 1: Fix `save_composition` path**

In `src/api/api/hypercut.ts`, find `save_composition` function (line 99):

Replace:
```typescript
  const compPath = `${outputDir}/hypercut-${jobId}.html`;
```

With:
```typescript
  const compPath = `${outputDir}/hypercut-${jobId}/index.html`;
```

- [ ] **Step 2: Remove `add_suggestion_to_composition` function**

Delete the entire `add_suggestion_to_composition` function (lines 105-126) from `src/api/api/hypercut.ts`.

- [ ] **Step 3: Remove its export from `api/index.ts`**

In `src/api/api/index.ts`:

Remove `add_suggestion_to_composition` from the import list (line 32):
```typescript
import {
  post_hypercut,
  get_suggestions,
  accept_suggestion,
  reject_suggestion,
  render_job,
  get_composition,
  save_composition,
  add_suggestion_to_composition,  // <-- DELETE this line
} from "./hypercut";
```

Remove the route (lines 163-166):
```typescript
app.post("/composition/:job_id/add-suggestion", async (c) => {
  const body = await c.req.json();
  return add_suggestion_to_composition(c.req.param("job_id"), body);
});
```

- [ ] **Step 4: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 5: Commit**

```bash
git add src/api/api/hypercut.ts src/api/api/index.ts
git commit -m "fix: save_composition path, remove deprecated add-suggestion endpoint"
```

---

## Task 5: Simplify `hypercut-bridge.js` — remove postMessage, keep iframe src setup

**Files:**
- Modify: `static/js/hypercut-bridge.js`

- [ ] **Step 1: Replace entire file with simplified version**

```javascript
// Sets up the HyperFrames Studio iframe src from the preview subprocess
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var iframe = document.getElementById("hyperframes-studio-iframe");
    if (!iframe) return;

    var jobId = iframe.getAttribute("data-job-id");
    if (!jobId) return;

    fetch("/api/hypercut/" + jobId + "/preview")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.url) iframe.src = data.url;
      })
      .catch(function (err) {
        console.error("HyperCut: preview server error", err);
      });
  });
})();
```

Key changes:
- Removed: loading overlay, pendingMessages, postMessage listening, `sendToStudio()`, "Add to Timeline" click handler
- Kept: iframe src setup from `/api/hypercut/{jobId}/preview`
- Studio handles hot reload internally — no postMessage bridge needed

- [ ] **Step 2: Commit**

```bash
git add static/js/hypercut-bridge.js
git commit -m "refactor: simplify hypercut-bridge to iframe src setup only"
```

---

## Task 6: Simplify `agent-chat.js` — remove sendToStudio reload call

**Files:**
- Modify: `static/js/agent-chat.js`

- [ ] **Step 1: Remove `sendToStudio` call from done event handler**

In `static/js/agent-chat.js`, find the `done` event handler (around line 164):

Replace:
```javascript
            case "done":
              removeToolIndicator();
              if (streamingMsg) streamingMsg.finalize();

              // Reload if composition was edited
              if (data.compositionEdited) {
                window.sendToStudio &&
                  window.sendToStudio("hypercut-reload-composition");
              }
              streaming = false;
              break;
```

With:
```javascript
            case "done":
              removeToolIndicator();
              if (streamingMsg) streamingMsg.finalize();
              streaming = false;
              break;
```

Studio hot reload detects file changes automatically — no manual reload needed.

- [ ] **Step 2: Commit**

```bash
git add static/js/agent-chat.js
git commit -m "refactor: remove sendToStudio reload, studio hot reload handles it"
```

---

## Task 7: Update `hypercut.tsx` template — remove add-to-timeline class, fix script tags

**Files:**
- Modify: `src/templates/hypercut.tsx`

- [ ] **Step 1: Change "Add" button from add-to-timeline to accept-only**

In `src/templates/hypercut.tsx`, find the "Add" button in `HypercutSuggestions` (around line 171):

Replace:
```tsx
                      <button
                        class="btn btn-xs btn-success add-to-timeline"
                        style="cursor:pointer"
                        data-suggestion-id={s.id}
                        data-job-id={props.jobId}
                      >
                        Add
                      </button>
```

With:
```tsx
                      <button
                        class="btn btn-xs btn-success"
                        style="cursor:pointer"
                        hx-post={`/api/jobs/hypercut/suggestions/${s.id}/accept`}
                        hx-swap="none"
                      >
                        Add
                      </button>
```

Key changes:
- Removed `add-to-timeline` class (no JS click handler)
- Removed `data-suggestion-id` / `data-job-id` (not needed)
- Added `hx-post` to accept endpoint directly
- Added `hx-swap="none"` (no DOM swap needed for 204 response)

- [ ] **Step 2: Verify build**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/templates/hypercut.tsx
git commit -m "refactor: suggestion Add button uses hx-post accept, remove add-to-timeline"
```

---

## Task 8: Remove `addSuggestionToComposition` from `hypercut-workflow.ts`

**Files:**
- Modify: `src/hypercut/hypercut-workflow.ts`

- [ ] **Step 1: Delete the deprecated function**

In `src/hypercut/hypercut-workflow.ts`, delete the entire `addSuggestionToComposition` function (lines 165-184):

```typescript
  export async function addSuggestionToComposition(
    jobId: string,
    outputDir: string,
    suggestionId?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    ...
  }
```

- [ ] **Step 2: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (0 errors — no callers remain after Task 4 removed the API endpoint)

- [ ] **Step 3: Commit**

```bash
git add src/hypercut/hypercut-workflow.ts
git commit -m "refactor: remove deprecated addSuggestionToComposition"
```

---

## Task 9: Delete dead code files

**Files:**
- Delete: `src/mcp/mcp-video.ts`
- Delete: `src/hypercut/hyperframes-island.tsx`
- Delete: `static/js/hyperframes-island.js`
- Delete: `scripts/patch-core-beats.js`
- Delete: `src/@types/hyperframes-engine.d.ts`

- [ ] **Step 1: Check for any remaining imports of deleted files**

Run these searches and verify no results (or only results in the files being deleted):

```bash
rg "mcp-video" src/ --type ts
rg "hyperframes-island" src/ static/ --type ts --type tsx
rg "patch-core-beats" .
rg "@hyperframes/engine" src/
```

If any active imports found outside the files being deleted, remove those import lines too.

- [ ] **Step 2: Remove `postinstall` script from `package.json`**

In `package.json`, remove this line from `scripts`:
```json
    "postinstall": "bun run scripts/patch-core-beats.js",
```

- [ ] **Step 3: Delete the files**

```bash
rm src/mcp/mcp-video.ts
rm src/hypercut/hyperframes-island.tsx
rm static/js/hyperframes-island.js
rm scripts/patch-core-beats.js
rm src/@types/hyperframes-engine.d.ts
```

- [ ] **Step 4: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 5: Run lint**

Run: `bun run lint`
Expected: PASS (0 errors)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove dead code (mcp-video, island, patch-core-beats, engine types)"
```

---

## Task 10: Final verification — typecheck, lint, build CSS, manual test

**Files:**
- None (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (0 errors)

- [ ] **Step 2: Run full lint**

Run: `bun run lint`
Expected: PASS (0 errors)

- [ ] **Step 3: Run all tests**

Run: `bun test`
Expected: PASS (all tests)

- [ ] **Step 4: Build CSS**

Run: `bun run build:css`
Expected: Success

- [ ] **Step 5: Start server and verify**

Run: `bun start:hot`

Then verify with curl:
```bash
curl -s http://localhost:3000/create/hypercut | grep -o "HyperCut"
```
Expected: Output contains "HyperCut"

- [ ] **Step 6: Verify composition format with a test job**

If a job exists:
```bash
# Find a hypercut job ID
JOB_ID=$(sqlite3 data.db "SELECT id FROM jobs WHERE workflow='hypercut' LIMIT 1")
# Check the composition file exists at the correct path
OUTPUT_DIR=$(grep OUTPUT_DIR .env | cut -d= -f2)
cat "${OUTPUT_DIR}/hypercut-${JOB_ID}/index.html" | grep -o 'data-composition-id="[^"]*"'
```
Expected: `data-composition-id="hypercut-{jobId}"` (on `#stage`, not `<html>`)

- [ ] **Step 7: Final commit if any remaining changes**

```bash
git status
# If clean, nothing to commit
# If changes remain, review and commit
```
