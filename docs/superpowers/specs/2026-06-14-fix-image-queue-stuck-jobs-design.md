# Fix: Image Jobs Stuck with Zero Events

## Problem
Distinct image creation (`POST /api/jobs/images`) creates a job row but never creates any `events` rows. The job stays `active` forever and the queue has nothing to process. The same bug exists in `POST /api/jobs/videos` (`text_to_image_to_video`).

## Root Cause
`src/api/api/text-to-image.ts` calls:

```ts
void PromptGenerator.txt_to_img_prompt(
    jobId,           // message param
    JobMode.Image,   // batchSize param (string "image", not a number)
    prompt,          // preset param
    batchSize,
    options.style_preset,
);
```

`txt_to_img_prompt(message, batchSize = 1, preset?)` expects the prompt text as `message`, a number as `batchSize`, and an optional preset. Because `batchSize` receives `"image"`, the loop `for (let i = 0; i < batchSize; i++)` never executes and the function returns an empty array. The call is `void`ed, so the failure is silent. No events are scheduled.

In addition, `txt_to_img_prompt` only generates prompt strings; callers are responsible for calling `ImageGenerator.schedule_image()`. The helper `PromptGenerator.styled_img_to_event()` already performs both steps correctly and is used by the autocut workflow.

## Design
1. **Fix the distinct-image API** (`text-to-image.ts`): use `styled_img_to_event()` in a loop for `batch_size` images, await the results, and fail the job on error.
2. **Fix the placeholder video API** (`text-to-image-to-video.ts`): same fix, using `JobMode.Video`.
3. **Queue recovery** in `src/db/db.ts`: extend `finalizeCompletedJobs()` (or add a dedicated cleanup) to mark active jobs with zero events as failed, preventing them from blocking the dashboard forever.
4. **Verification**: start the dev server, `curl` `POST /api/jobs/images`, and confirm events rows are created and the job reaches `complete` after generation (or at least `active` with pending/running events, not zero events).

## Success Criteria
- `POST /api/jobs/images` creates `batch_size` pending `new_image_prompt` events.
- No new job is created with zero events.
- Existing orphaned active jobs are cleaned up.
- Typecheck and lint pass.
