## 1. Backend — Refactor `text_to_image()` to accept prompt + options

- [ ] 1.1 Update `src/api/text-to-image.ts` signature to accept an options object (prompt, batch_size, resolution, style_preset) with sensible defaults (default batch_size = 1, default resolution = "480p", default style_preset = Presets.PENCIL_WATERCOLOR)
- [ ] 1.2 Make prompt required in the function — throw a clear error or return a helpful JSON response if not provided
- [ ] 1.3 Pass `batch_size`, `resolution`, and `style_preset` through to `PromptGenerator.txt_to_img_prompt()` (currently only passes jobId, JobMode.Image, prompt, batch_size, Presets.PENCIL_WATERCOLOR)

## 2. Backend — Wire POST handler for `/api/jobs/images` with options

- [ ] 2.1 Add a POST route at `src/api/api/index.tsx` that reads the request body (multipart/form-data or JSON), extracts prompt + generation options, and calls `text_to_image()`
- [ ] 2.2 Return the job id in the response so the frontend can track progress via SSE events
- [ ] 2.3 Keep existing GET `/api/jobs/images` working for backwards compatibility (uses hardcoded prompt as before)

## 3. Route group — Create `src/api/create/index.tsx`

- [ ] 3.1 Follow the established pattern: detect `HX-Request` header, return `<OobHeader>` + component on HTMX requests, full `<Layout><App page="image">...</App></Layout>` otherwise
- [ ] 3.2 Accept optional `job_id` and `show_progress` query params (like `/compose`)

## 4. Template — Create `DistinctImage` component in `src/templates/distinct-image.tsx`

- [ ] 4.1 Outer container: `<div className="flex flex-col sm:px-6 py-6 xl:h-full bg-base-200">` with `<ErrorToast />`, matching compose layout
- [ ] 4.2 Form element wrapping all cards, `hx-post="/api/jobs/images"`, `hx-encoding="multipart/form-data"`, `hx-swap="none"` — match compose form pattern
- [ ] 4.3 Left column card (1): Prompt input — `<textarea name="prompt">` with placeholder "Describe the image you want to generate..." — matching compose's script textarea styling (`textarea textarea-ghost`)
- [ ] 4.4 Left column card (2): Generation options — same structure as compose Card 2 & Card 3:
    - Batch size range slider using Alpine.js (`x-data="{ batchSize: 1 }"`), `<input type="range" name="batch_size">`, output showing live value
    - Resolution dropdown with `<option value="480p">480p</option>` and `<option value="720p">720p</option>` — matching compose exactly
- [ ] 4.5 Left column card (3): Style preset dropdown using DaisyUI `select select-bordered` with options: system, watercolor, pencil_watercolor — matching compose Card 4 exactly
- [ ] 4.6 Left column card (4): Action card — Reset button (`btn btn-ghost`) + Generate button (`btn btn-primary`) with loading spinner inside `<span class="loading loading-spinner ml-2">` that toggles via HTMX — matching compose Card 5

## 5. Template — Results area in `DistinctImage` component

- [ ] 5.1 Right column card (full height): if no job yet, show a placeholder with icon and "Enter a prompt and click Generate" message
- [ ] 5.2 When `showProgress=true` and `jobId` is provided: render an element with `hx-sse="/jobs/events"` to connect to the SSE stream — same pattern as compose's progress card (lines 387-432)
- [ ] 5.3 The SSE stream delivers Event.ComfyExecuted messages which HTMX automatically processes; when images are ready, they're swapped in-place via `hx-swap` triggered by the event
- [ ] 5.4 Render generated image(s) as `<img>` tags with appropriate src pointing to the stored image files — use a placeholder div that gets replaced on SSE event delivery
- [ ] 5.5 Show prompt text and selected options (batch size, resolution, style) as metadata below each generated image — matching spec requirement that "Job metadata is preserved"

## 6. Registration — Wire the component into the app

- [ ] 6.1 Add `DistinctImage` export to `src/templates/templates.ts`: import from `./distinct-image`, add to `Templates` namespace
- [ ] 6.2 Register route group in `src/api/api.tsx`: `app.route("/create", createRoutes)` (following the existing pattern of `app.route("/compose", composeRoutes)`)

## 7. Verification — Test end-to-end

- [ ] 7.1 Navigate to `/create/image` via sidebar click — verify form loads with empty prompt field and placeholder
- [ ] 7.2 Enter a prompt, select options (batch_size=2, resolution="480p", style_preset="watercolor"), submit — verify job created in backend
- [ ] 7.3 Wait for job completion (check via browser network tab or poll status) — verify images display in the right column after completion
- [ ] 7.4 Verify only this job's images appear in the view (not older gallery items)
