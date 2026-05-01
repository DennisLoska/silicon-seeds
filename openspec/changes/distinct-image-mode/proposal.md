## Why

Composite mode handles full pipeline generation (script → TTS → music → image scenes → video), but users often want to quickly generate standalone images from text input — without the complexity of video production. The sidebar already has an "Image" item that links to `/create/image`, which currently has no route handler and is a dead link. This change fills that gap with a focused, simplified UI for text-to-image generation using existing backend infrastructure.

## What Changes

- Create a new `src/api/create/index.tsx` route group handling GET/POST at `/create/image`
- Add a `DistinctImage` component in `src/templates/distinct-image.tsx` following the established template pattern (HTMX + DaisyUI)
- Register the `DistinctImage` component in `src/templates/templates.ts`
- Wire up routing in `src/api/api.tsx` under `/create/image`
- Refactor `text_to_image()` handler to accept a prompt from request body/query parameters instead of using hardcoded strings
- The image is stored as a job with `JobMode.Image`, same backend path used by composite mode (but simpler UI)

## Capabilities

### New Capabilities
- `distinct-image-mode`: Standalone text-to-image generation via dedicated UI, reusing existing ComfyUI pipeline and `text_to_image()` handler

### Modified Capabilities
<!-- No spec-level requirement changes — only new capability -->

## Impact

**New files:**
- `src/api/create/index.tsx` — route group for `/create/image`
- `src/templates/distinct-image.tsx` — view component (form + result display)

**Modified files:**
- `src/templates/templates.ts` — register DistinctImage component
- `src/api/api.tsx` — add route at `/create/image`
- `src/api/api/text-to-image.ts` — refactor `text_to_image()` to accept prompt from request (query params or body)

**No changes:** database, events system, backend orchestrator, or ComfyUI client. All image generation flows through existing infrastructure unchanged.
