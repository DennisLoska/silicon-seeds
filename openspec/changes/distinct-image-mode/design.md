## Context

The project currently has:
- A sidebar in `src/templates/app.tsx` with an "Image" link (`/create/image`) that has no route handler
- Working text-to-image backend via `GET /api/jobs/images` → `text_to_image()` → ComfyUI pipeline
- Composite mode at `/compose` as the reference pattern for HTMX + DaisyUI views, using:
  - Full-page layout with a form containing multiple cards (script input left, settings/action/progress stacked right)
  - Card-based UI with icons (DaisyUI `card bg-base-100 shadow-xl`)
  - Alpine.js state on range sliders for live feedback (`x-data`, `x-model`, `<output>`)
- Gallery and dashboard pages demonstrating established routing/template patterns

Users want a focused, standalone image generation UI without the complexity of composite video production.

## Goals / Non-Goals

**Goals:**
- Create a dedicated view accessible via the sidebar "Image" link
- Allow users to enter custom prompts for text-to-image generation
- Expose configurable generation options: batch size, resolution, style preset
- Display results inline using HTMX (no page reload)
- Reuse existing `text_to_image()` backend logic with prompt and options from request

**Non-Goals:**
- Backend changes beyond refactoring `text_to_image()` to accept a prompt parameter and generation options
- Image editing, upscaling, or other post-generation operations
- Video-related settings (no fps/clip duration/transition controls — purely image focused)
- Authentication for distinct mode (same access as existing routes)

## Decisions

1. **Reuse `text_to_image()` handler instead of creating new API route.** The existing function already orchestrates the full pipeline; only the prompt source needs to change (hardcoded → request parameter). This avoids duplicating backend logic and keeps the ComfyUI integration in one place.

2. **Route group at `/create/image`** — follows the sidebar link path exactly. New file `src/api/create/index.tsx` mirrors the structure of other route groups (`dashboard/`, `compose/`). The handler detects `HX-Request` to serve either a full layout or an HTMX fragment.

3. **Form uses `hx-post="/api/jobs/images"` with multipart/form-data** — consistent with composite mode's form pattern, allowing both text prompt and any future file upload fields in the same submission path. The submit button is disabled during generation via `hx-disable-element`.

4. **Status via SSE with HTMX swap** — after form submission, `hx-redirect` sends user back to `/create/image?job_id={id}` which loads a page containing an element with `hx-sse="/jobs/stream"` connected to the event stream. When ComfyUI completes and fires Event.ComfyExecuted, the SSE message triggers HTMX to swap in generated images — no polling, no scripts needed. This is identical to composite mode's progress card pattern but without the full UI complexity.

5. **DaisyUI card layout matching composite mode UX** — the view follows the same visual structure as compose:
   - Left column (full height): prompt textarea + generation options in stacked cards
   - Right column (full height): placeholder image or "Job queued" status, then generated images on completion
   - Each section uses `card bg-base-100 shadow-xl` with consistent icon styling
   - On mobile (<xl breakpoint), stacks to single-column layout

6. **Resolution presets match ComfyUI-supported sizes** — the backend maps `"480p"` → 640x480 and `"720p"` → 1280x720 (see `comfyui-client.ts` lines 239-245). The dropdown offers only these two options, consistent with composite mode.

7. **Style presets match existing enum** (`SYSTEM`, `WATERCOLOR`, `PENCIL_WATERCOLOR`) — reusing the same `Presets` enum ensures consistency with composite mode and avoids duplicating style logic. The `text_to_image()` handler passes the selected preset to `PromptGenerator.txt_to_img_prompt()`.

8. **Batch size defaults to 1** — users can optionally generate multiple images per prompt by selecting a batch count > 1. Each generated image gets a unique filename prefix within the same job, and all appear together in the result display once complete. Implemented as an Alpine.js range slider similar to composite mode's fps/clip_duration sliders (`<input type="range">` with `x-model`, `<output>` for live value).

9. **Layout structure** — matches compose.tsx pattern:
   ```
   <form> (full viewport height, flex row on xl+)
     └── Left column (xl:w-1/2): Script card + Settings + Action card
     └── Right column (xl:w-1/2): Progress/Results card
   ```

## Risks / Trade-offs

[Risk: Prompt parameter conflicts with existing query params] → The current handler ignores query parameters for prompts but uses them elsewhere. Refactoring to read prompt from POST body (not GET) eliminates this conflict.

[Risk: User navigates away from /create/image while job is processing] → Mitigation: `hx-redirect` on POST success sends user back to `/create/image?job_id={id}` which has an SSE element connected to the event stream. The page persists and HTMX automatically swaps in images when ComfyExecuted events arrive — no polling or scripts needed, same pattern as composite mode's progress card.

[Risk: Large batch sizes cause slow generation or timeouts] → Batch size of 3+ generates multiple images sequentially through ComfyUI, which can take significant time. Mitigation: set a reasonable max (e.g., 5), show clear progress indicator with per-image count ("2/4 completed"), and allow cancel via HTMX abort if supported.

[Trade-off: POST vs separate API route for distinct mode] → Using POST to `/api/jobs/images` means the same endpoint handles both composite-triggered image generation and standalone generation. This is acceptable because `JobMode.Image` vs `JobMode.Video` already differentiates them in the events system. A dedicated endpoint would add code but not real architectural benefit.

[Trade-off: Prompt + options stored only in job metadata, not separately] → For this change, we store prompt and style_preset with the job record since they're used for display during generation and on the jobs page. Batch size is tracked via `JobOrchestrator.create_job()` parameters (or passed through `text_to_image()`). This avoids a new DB migration while keeping context visible to users.

## Migration Plan

No migration needed. The `text_to_image()` refactoring is backward-compatible (if no prompt is provided, fall back to existing behavior or error). All changes are additive — no existing routes or templates are modified in incompatible ways.

The only potential breaking change: if external callers use `GET /api/jobs/images` expecting it to always return the hardcoded response, they would need to switch to POST with a body for custom prompts. Internal usage (sidebar link + form submit) is unaffected.

### Implementation steps
1. Create `src/api/create/index.tsx` route group — register at `/create/image` in `api.tsx`
2. Add `DistinctImage` component to `templates.ts` and create `distinct-image.tsx` template
3. Refactor `text_to_image()` in `text-to-image.ts` to accept prompt + options from request body (POST) or query params (GET fallback for existing behavior), return job id on success

## Open Questions

- Should distinct mode display recent generations from other sessions? Currently jobs are viewable via `/jobs` but not inline. Worth adding in a follow-up if users request it.
