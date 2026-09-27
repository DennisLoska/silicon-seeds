# Text-to-Video Dedicated Page Design

Date: 2026-09-27
Status: approved
Route: `/create/text-to-video`, sidebar "Text to Video"

## Problem

`/create/video` (`src/client/pages/CreateVideo.tsx:9`) shows Loras card, Style Preset select, intermediate image preview. All dead for video path. Backend `text_to_image_to_video` stores preset/loras in job row only, never injects into T2V graph. Users confused. Need clean dedicated T2V page, existing Video page untouched.

## Evidence (verified 2026-09-27)

- `src/api/api/text-to-image-to-video.ts:21` `finalPrompt = prompt + style_guide`, preset stored `:31`, loras stored `:34`, only prompt passed to `schedule_text_to_video :37`
- `src/video/video-generator.ts:140` `schedule_text_to_video` signature `jobId,prompt,index` only, no style/loras
- `src/video/video-generator.ts:209-215` `filename null` → `kind: text-to-video` prompt-only
- `src/comfyui/comfyui-client.ts:409-432` T2V sets prompt/geometry/filename_prefix only
- `src/comfyui/comfyui-client.ts:370-405` lora chain only under `text-to-image`
- `src/queue/queue-manager.ts:169` `style_preset` used for txt_to_img only
- `src/comfyui/comfyui-client.ts:25` only `Text2ImgInput` carries loras type

Conclusion: Style Guide live, Style Preset dead, Loras dead, intermediate image never renders for pure T2V.

## Architecture

Clone, not refactor. New file `src/client/pages/CreateTextToVideo.tsx` copied from `CreateVideo.tsx` (302 lines). Same POST `/api/jobs/videos`, same SSE `useJobUpdates`, same progress timeline. No backend change. No new API. Existing `/create/video` untouched.

Components:
- `CreateTextToVideo.tsx` - form + preview, strips 3 blocks, drops unused imports (`LoraSelector`, `StylePresetSelect`, `loras` signal, `FormData loras` set)
- `App.tsx` - lazy import + `<Route path="/create/text-to-video">`
- `Layout.tsx` - `getPageTitle` map + sidebar `<A href="/create/text-to-video" id="sidebar-text-to-video">` with Video icon, placed directly after Video entry
- e2e `e2e/create-text-to-video.spec.ts` cloned from `create-video.spec.ts`

## Data Flow

1. User fills prompt + style_guide + video_model/fps/duration/resolution → POST `/api/jobs/videos` FormData (no loras, no style_preset)
2. Server `text_to_image_to_video` creates job, `schedule_text_to_video(jobId,prompt)` with `filename null`
3. `generate_video` → `kind: text-to-video` → `comfyClient.generate` → LTX T2V graph or Wan I2V+dummy
4. SSE `job-update` → refetch events/media → video preview `<video>` renders

Unchanged from existing Video. Stripped fields simply omitted from FormData; backend defaults apply (`image_model z-image-turbo`, preset null).

## UI Layout (same as Video, minus 3)

Keep:
- Prompt textarea `name="prompt" #video-prompt`
- Style Guide textarea `name="style_guide"`
- Video Model select `name="video_model"` wan2.2/ltx2.3
- FPS range `name="fps"` 1-24, Duration `name="clip_duration"` 1-10, Resolution `name="resolution"`
- Job Progress timeline, Generated Video `<video>` block
- Action card Generate Video / Reset

Strip:
- Loras card (`LoraSelector` + `loras` signal)
- Style Preset card (`StylePresetSelect`)
- Intermediate image block (`imageItems` grid, "Intermediate image (used for I2V)")

IDs must stay compatible for tests: keep `#video-prompt`, `#style-guide`, `#submit-btn`. New sidebar id `sidebar-text-to-video`.

## Error Handling

Same as clone source: POST non-OK → error alert 600 chars, `isSubmitting` reset. No new failure modes. Missing prompt → backend 400, surfaced same way. No migration, no schema change.

## Testing

- e2e `create-text-to-video.spec.ts`: goto `/create/text-to-video`, fill prompt/style_guide, select model/resolution/fps/duration, Reset clears, Generate heading visible, URL stays. Negative asserts: `select[name="style_preset"]` count 0, `LoraSelector` absent, no intermediate image text.
- Existing `create-video.spec.ts` must still pass untouched.
- Verify: `bunx tsc --noEmit`, `bun run lint`, `bunx playwright test e2e/create-text-to-video.spec.ts e2e/create-video.spec.ts`
- Manual: `bun start:hot`, curl `http://localhost:3000/create/text-to-video`, chrome devtools snapshot sidebar + form.

## Out of Scope

- No backend T2V workflow change (Wan native T2V file exists but unwired, separate task)
- No removal of dead UI from old `/create/video`
- No style preset support for video (needs prompt-engineering design, separate)
- No lora support for video (needs ComfyUI graph change, separate)

## Files

- NEW `src/client/pages/CreateTextToVideo.tsx`
- EDIT `src/client/App.tsx:10,66`
- EDIT `src/client/components/Layout.tsx:6,77`
- NEW `e2e/create-text-to-video.spec.ts`
- SPEC this file
