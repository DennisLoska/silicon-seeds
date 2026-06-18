# HyperCut Studio Integration Design (Option D)

## Problem

PR #53 (`feat/hypercut-timeline`) introduced HyperCut but the timeline is broken and the composition is not correctly rendered. Root causes:

1. **Composition path mismatch** — `hypercut-workflow.ts` writes to `${OUTPUT_DIR}/hypercut-${jobId}/index.html` but the agentic editor tools (`read_composition`/`write_composition`) and `save_composition` API read/write `${OUTPUT_DIR}/hypercut-${jobId}.html`. The agent can never read or persist edits.
2. **Wrong composition format** — `generateHyperframesHtml()` from `@hyperframes/core` emits studio-internal serialization (`data-composition-id` on `<html>`, legacy `data-end`/`data-layer` attrs, elements nested in `#stage > #stage-zoom-container`, no `class="clip"`). The standalone contract that `npx hyperframes preview`/`render` expects requires `data-composition-id` on the root `#stage` div, `data-start`/`data-duration`/`data-track-index` + `class="clip"` on clips, and `data-start="0"` on root.
3. **Fragile timeline registration hack** — `hypercut-workflow.ts:152-155` string-replaces `const tl = gsap.timeline(...)` to inject `window.__timelines[...]`. This breaks when the generator output changes and is unnecessary: the runtime handles clip lifecycle (show/hide at `data-start`/`data-duration`) automatically. Manual `window.__timelines` registration blocks Studio drag/resize edit persistence (`gsap_studio_edit_blocked` lint warning).
4. **Dead code** — `src/mcp/mcp-video.ts` (0 bytes), `src/hypercut/hyperframes-island.tsx` (0 bytes), `static/js/hyperframes-island.js` (0 bytes), `scripts/patch-core-beats.js` (adds `./beats` export nothing imports), `addSuggestionToComposition` returns "deprecated" error, bridge.js "Add to Timeline" flow wires to a no-op.
5. **`@hyperframes/studio` package not installed** — PR description claims a React studio app in `studio/` dir, but the directory was deleted and the package is absent from `node_modules`. The memory note confirms the Timeline component requires providers not exported from the package.

## Solution

Use `npx hyperframes preview` as a subprocess (already implemented in `preview-manager.ts`) to serve the full HyperFrames Studio UI in an iframe. Fix the composition format and path bugs. Remove dead code. The Studio provides timeline scrubber, clip selection, move/trim editing with persistence back to `index.html`, and hot reload — all built by the hyperframes team, no React/build step in our app.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser: /create/hypercut?job_id={id}                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ HTMX/DaisyUI shell                                                      ││
│  │ ┌──────────────┐  ┌─────────────────────────┐  ┌─────────────────────┐ ││
│  │ │ Suggestions  │  │ <iframe>                │  │ AI Editor Chat      │ ││
│  │ │ Panel (HTMX) │  │  src=http://127.0.0.1:  │  │ (fetch SSE stream)  │ ││
│  │ │              │  │    {port}/              │  │                     │ ││
│  │ │ hx-get       │  │  Full HyperFrames       │  │ POST /api/hypercut/ │ ││
│  │ │ every 5s     │  │  Studio UI:             │  │   {id}/chat         │ ││
│  │ │              │  │  - Preview player       │  │                     │ ││
│  │ │ [Accept]     │  │  - Timeline w/ drag     │  │ Agent tools:        │ ││
│  │ │ [Skip] btns  │  │  - Player controls      │  │  read_composition   │ ││
│  │ │              │  │  - Hot reload on file   │  │  write_composition  │ ││
│  │ └──────────────┘  │    change               │  │  search_media       │ ││
│  │                   │                         │  │  get_suggestions    │ ││
│  │                   │  Served by:             │  │  accept/reject      │ ││
│  │                   │  npx hyperframes preview│  │  get_transcript     │ ││
│  │                   │  (subprocess)           │  │  get_job_info       │ ││
│  │                   └─────────────────────────┘  └─────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bun Backend (Hono)                                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ File: ${OUTPUT_DIR}/hypercut-${jobId}/index.html                      │  │
│  │                                                                       │  │
│  │  Single source of truth for composition. Both Studio drag/resize     │  │
│  │  edits and agent chat write_composition edits hit this same file.    │  │
│  │  Studio hot reload picks up changes automatically.                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ preview-manager  │  │ agentic-editor   │  │ hypercut-workflow        │  │
│  │ .ts              │  │ .ts              │  │ .ts                      │  │
│  │                  │  │                  │  │                          │  │
│  │ spawns:          │  │ read_composition │  │ generateInitialComp:    │  │
│  │ npx hyperframes  │  │ write_composition│  │  writes index.html in   │  │
│  │ preview <dir>    │  │ → same path as   │  │  standalone format       │  │
│  │ --port <port>    │  │   workflow writes│  │                          │  │
│  │ --no-open        │  │                  │  │ buildChunkedClips:       │  │
│  │                  │  │ tools now use    │  │  unchanged (element      │  │
│  │ returns port     │  │ correct path:    │  │  data structure stays)   │  │
│  │                  │  │ ${OUTPUT_DIR}/   │  │                          │  │
│  │                  │  │ hypercut-{id}/   │  │ generateStandaloneHtml:  │  │
│  │                  │  │ index.html       │  │  NEW — replaces          │  │
│  │                  │  │                  │  │  generateHyperframesHtml  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Design Decisions

### 1. `npx hyperframes preview` subprocess for Studio UI

The Studio is a full React application built by the hyperframes team. It provides:
- Preview player (same runtime as render)
- Timeline with drag/trim/move editing
- Player controls (play, pause, seek, frame-step)
- Hot reload (file changes auto-refresh preview)
- Clip persistence (drag/trim writes back to `index.html`)

Running it as a subprocess via `preview-manager.ts` avoids importing `@hyperframes/studio` as a dependency, avoids React/react-dom/zustand peer deps, avoids a build step, and avoids the missing-provider-exports problem that killed PR #53's React island approach.

`preview-manager.ts` already implements this correctly. It just needs the composition file to be in the right format and path.

### 2. Standalone composition format (not `generateHyperframesHtml`)

`generateHyperframesHtml()` from `@hyperframes/core` produces studio-internal serialization format, not the standalone composition contract. Instead of fighting the generator with post-processing hacks, we write a small focused `generateStandaloneHtml()` function that produces the exact format the runtime/preview/render expects.

Standalone composition contract (from `hyperframes-core/SKILL.md` + `minimal-composition.md` + verified by `npx hyperframes preview` testing):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>HyperCut {jobId}</title>
    <style>
      body { margin: 0; background: #000; }
      #stage { position: relative; width: {W}px; height: {H}px; overflow: hidden; }
      .clip { position: absolute; inset: 0; }
      video.clip { width: 100%; height: 100%; object-fit: contain; }
    </style>
  </head>
  <body>
    <div id="stage"
      data-composition-id="hypercut-{jobId}"
      data-start="0"
      data-width="{W}"
      data-height="{H}"
      data-duration="{totalDuration}"
    >
      <video id="seg-0" class="clip"
        data-start="0" data-duration="5.2" data-track-index="0"
        data-media-start="0" data-name="Segment 1"
        src="source_{jobId}.mp4" muted playsinline
      ></video>
      <video id="seg-1" class="clip"
        data-start="5.2" data-duration="3.1" data-track-index="0"
        data-media-start="5.2" data-name="[FILLER] um"
        src="source_{jobId}.mp4" muted playsinline
      ></video>
    </div>
  </body>
</html>
```

Key rules (verified):
- `data-composition-id` on root `#stage` div (NOT on `<html>`)
- `data-start="0"` on root (required — runtime needs it to begin playback)
- `data-width` / `data-height` on root
- `data-duration` on root (render duration)
- `class="clip"` on every visible timed element (required — without it runtime shows element for whole composition)
- `data-start` / `data-duration` / `data-track-index` on each clip
- Clips are DIRECT children of root (no wrapper divs)
- `data-media-start` for media offset into source
- `data-name` for clip label (shown in Studio timeline)
- NO manual `window.__timelines` registration — the runtime handles clip lifecycle (show/hide at data-start/data-duration). Manual timeline registration blocks Studio drag/resize persistence (`gsap_studio_edit_blocked`).
- `<video>` elements use `muted` + `playsinline` for browser compatibility

If the agent or user wants to add animations (GSAP tweens), they can add a `<script>` with `window.__timelines["hypercut-{jobId}"] = tl` targeting specific elements. But the initial composition should NOT have a manual timeline — it should rely on the clip lifecycle for show/hide so Studio editing works.

### 3. Single source of truth: `index.html`

Both Studio drag/trim edits and agent `write_composition` edits write to the same file:
`${OUTPUT_DIR}/hypercut-${jobId}/index.html`

Studio hot reload watches this file and auto-refreshes the preview when it changes. No postMessage bridge needed for reload — the Studio handles it internally.

The agent's `read_composition` and `write_composition` tools must use this exact path (fixing the current `.html` vs `/index.html` mismatch).

### 4. Source video in project dir

The source video is copied into the project directory as `source_{jobId}.mp4` so the composition HTML can reference it with a relative path. This is what `npx hyperframes preview` serves. The existing `/assets/source/{jobId}` route is kept for the HTMX suggestions panel preview but the composition itself uses the relative path in the project dir.

### 5. Suggestions panel: Accept = DB update only

The "Add" button on suggestions accepts the suggestion (DB status = `accepted`). The user then tells the agent chat "add accepted suggestions to the timeline" or adds them manually via Studio. The deprecated `addSuggestionToComposition` endpoint and the bridge.js "Add to Timeline" → `POST /api/composition/{id}/add-suggestion` flow are removed.

This simplifies the flow: suggestions panel is purely for review/accept/reject. Timeline editing happens in Studio or via agent chat. No dual-path confusion.

### 6. Agent edits trigger Studio hot reload (no postMessage needed)

When the agent calls `write_composition`, it writes to `index.html`. The Studio's file watcher detects the change and hot-reloads the preview. The `agent-chat.js` `done` event handler currently calls `window.sendToStudio("hypercut-reload-composition")` — this is unnecessary with the subprocess Studio approach. The postMessage bridge can be simplified to just setting the iframe src.

## Files Changed

### Modify

| File | Change |
|------|--------|
| `src/hypercut/hypercut-workflow.ts` | Replace `generateHyperframesHtml()` call with new `generateStandaloneHtml()` function. Remove string-replace timeline hack. Keep `buildChunkedClips()` unchanged. |
| `src/hypercut/agentic-editor.ts` | Fix `read_composition`/`write_composition` tool paths: `${OUTPUT_DIR}/hypercut-${jobId}/index.html` (not `.html`). |
| `src/api/api/hypercut.ts` | Fix `save_composition` path: `${OUTPUT_DIR}/hypercut-${jobId}/index.html`. Remove `add_suggestion_to_composition` function. |
| `src/api/api/index.ts` | Remove `POST /composition/:job_id/add-suggestion` route. Remove `add_suggestion_to_composition` import. |
| `static/js/hypercut-bridge.js` | Remove postMessage message handling (studio handles hot reload internally). Remove "Add to Timeline" click handler (suggestions are accept-only now). Keep iframe src setup from preview endpoint. |
| `static/js/agent-chat.js` | Remove `window.sendToStudio("hypercut-reload-composition")` call on done event (studio hot reload handles it). |
| `src/templates/hypercut.tsx` | Remove `add-to-timeline` class from suggestion buttons. Wire "Add" button to `hx-post` accept endpoint only. Remove `hypercut-bridge.js` script tag (bridge simplified to inline iframe setup). Keep `agent-chat.js` script tag. |
| `package.json` | Remove `postinstall` script (`patch-core-beats.js`). Keep `@hyperframes/producer` (used by `render()` in `hypercut-workflow.ts`). |
| `tsconfig.json` | Remove `src/@types/hyperframes-engine.d.ts` if unused. |

### Delete

| File | Reason |
|------|--------|
| `src/mcp/mcp-video.ts` | 0 bytes, empty file |
| `src/hypercut/hyperframes-island.tsx` | 0 bytes, dead code |
| `static/js/hyperframes-island.js` | 0 bytes, dead code |
| `scripts/patch-core-beats.js` | Adds `./beats` export nothing imports |
| `src/@types/hyperframes-engine.d.ts` | Declares module nothing imports |

### New

| File | Purpose |
|------|---------|
| `src/hypercut/generate-standalone-html.ts` | `generateStandaloneHtml(elements, totalDuration, { compositionId, resolution, sourceVideoFilename })` — produces standalone composition HTML matching the hyperframes-core contract. |

## Composition HTML Generation

### `generateStandaloneHtml()`

```typescript
interface GenerateOptions {
  compositionId: string;
  resolution: "landscape" | "portrait" | "square";
  sourceVideoFilename: string;
}

function generateStandaloneHtml(
  elements: TimelineMediaElement[],
  totalDuration: number,
  options: GenerateOptions,
): string
```

Maps each `TimelineMediaElement` to a `<video class="clip">` element with:
- `id` = element.id
- `data-start` = element.startTime
- `data-duration` = element.duration
- `data-track-index` = element.zIndex (0 for source video track)
- `data-media-start` = element.mediaStartTime (offset into source)
- `data-name` = element.name (label shown in Studio timeline)
- `src` = options.sourceVideoFilename (relative path in project dir)
- `muted` + `playsinline` attributes

Root `#stage` div with:
- `data-composition-id` = options.compositionId
- `data-start="0"`
- `data-width` / `data-height` from resolution (1920×1080 landscape, 1080×1920 portrait, 1080×1080 square)
- `data-duration` = totalDuration

No `<script>` with `window.__timelines` — clip lifecycle handles show/hide. Studio drag/resize works.

### Resolution mapping

```
landscape → 1920 × 1080
portrait  → 1080 × 1920
square    → 1080 × 1080
```

## Verification

### Build/typecheck
```bash
bunx tsc --noEmit
bun run lint
```

### Manual test
```bash
bun start:hot
# Upload a video at /create/hypercut
# Wait for processing to complete
# Verify iframe loads Studio UI (timeline, preview, controls)
# Verify clips appear on timeline with correct labels
# Verify drag/trim a clip → index.html updates
# Verify agent chat "add a title overlay at 2s" → composition updates → Studio hot reloads
# Verify composition file path: ${OUTPUT_DIR}/hypercut-${jobId}/index.html
# Verify agent read_composition returns the same HTML
```

### Composition format check
```bash
# After processing, verify the generated index.html:
# - Has data-composition-id on #stage (not <html>)
# - Has data-start="0" on #stage
# - Has class="clip" on each <video>
# - Clips are direct children of #stage
# - No window.__timelines script
```

## Out of Scope

- Adding GSAP animations to the initial composition (agent can add them via chat)
- Text/image overlay elements in initial composition (agent can add them via chat)
- Sub-composition support (not needed for source video chunking)
- `@hyperframes/studio` as a dependency (using CLI subprocess instead)
- React island approach (abandoned — too fragile)
- Render pipeline changes (render already works via `@hyperframes/producer`)
- ChromaDB/WhisperX/transcript analyzer changes (working correctly)
