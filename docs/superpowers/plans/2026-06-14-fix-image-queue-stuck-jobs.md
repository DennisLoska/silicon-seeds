# Fix Image Jobs Stuck with Zero Events — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix `POST /api/jobs/images` and `POST /api/jobs/videos` so they actually schedule image events, and clean up existing orphaned active jobs.

**Architecture:** Replace the broken `txt_to_img_prompt()` call with `styled_img_to_event()` (which generates the prompt and schedules the event in one call). Add a DB cleanup step for active jobs that have zero events. Verify by hitting the running API and checking the SQLite DB.

**Tech Stack:** Bun, TypeScript, Hono, Kysely, SQLite, HTMX SSE

---

### Task 1: Fix `src/api/api/text-to-image.ts`

**Files:**
- Modify: `src/api/api/text-to-image.ts`
- Modify: `src/prompts/prompt-generator.ts` (only if a batch variant is needed)

- [ ] **Step 1: Replace fire-and-forget prompt generation with awaited event scheduling**

Current code:
```ts
const batchSize = batch_size;
void PromptGenerator.txt_to_img_prompt(
  jobId,
  JobMode.Image,
  prompt,
  batchSize,
  options.style_preset,
);
```

Replace with:
```ts
const batchSize = batch_size ?? 1;
const scheduled = await Promise.all(
  Array.from({ length: batchSize }, (_, index) =>
    PromptGenerator.styled_img_to_event(
      jobId,
      JobMode.Image,
      prompt,
      options.style_preset,
      index,
    ),
  ),
);

if (scheduled.some((event) => !event)) {
  await DB.Jobs.failJob(jobId);
  throw new Error("Failed to schedule one or more image events");
}
```

- [ ] **Step 2: Add missing imports**

Add `DB` import if not already present:
```ts
import { DB } from "../db/db";
```

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: no type errors in the modified file

- [ ] **Step 4: Commit**

```bash
git add src/api/api/text-to-image.ts
git commit -m "fix: schedule image events correctly in text-to-image endpoint"
```

---

### Task 2: Fix `src/api/api/text-to-image-to-video.ts`

**Files:**
- Modify: `src/api/api/text-to-image-to-video.ts`

- [ ] **Step 1: Apply the same fix using `JobMode.Video`**

Replace the `void PromptGenerator.txt_to_img_prompt(...)` call with:
```ts
const batchSize = 1;
const scheduled = await PromptGenerator.styled_img_to_event(
  jobId,
  JobMode.Video,
  prompt,
  Presets.WATERCOLOR,
);

if (!scheduled) {
  await DB.Jobs.failJob(jobId);
  throw new Error("Failed to schedule image event");
}
```

- [ ] **Step 2: Add missing imports**

```ts
import { DB } from "../db/db";
```

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add src/api/api/text-to-image-to-video.ts
git commit -m "fix: schedule image events correctly in text-to-image-to-video endpoint"
```

---

### Task 3: Clean up orphaned active jobs with zero events

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Add a cleanup function for jobs with zero events**

In `DB.Jobs`, add:
```ts
export async function failJobsWithNoEvents() {
  const orphanedJobs = await db
    .selectFrom("jobs")
    .leftJoin("events", "events.job_id", "jobs.id")
    .select("jobs.id")
    .where("jobs.status", "=", JobLifecycleStatus.Active)
    .groupBy("jobs.id")
    .having((eb) => eb.fn.count("events.id"), "=", 0)
    .execute();

  for (const job of orphanedJobs) {
    await failJob(job.id);
  }
}
```

- [ ] **Step 2: Call the cleanup on startup**

In `src/main.ts`, after `DB.Jobs.failBrokenJobs()` and before `DB.Jobs.finalizeCompletedJobs()`, add:
```ts
await DB.Jobs.failJobsWithNoEvents();
```

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add src/db/db.ts src/main.ts
git commit -m "fix: fail active jobs that have no events on startup"
```

---

### Task 4: Verify via API and DB

**Files:**
- No file changes

- [ ] **Step 1: Start the dev server**

Run: `bun start:hot` (or `bun src/main.ts` if hot reload is unavailable)
Wait until server is listening on `http://localhost:3000`.

- [ ] **Step 2: Submit an image job via curl**

Run:
```bash
curl -X POST http://localhost:3000/api/jobs/images \
  -H "Content-Type: multipart/form-data" \
  -F "prompt=Test prompt for queue fix" \
  -F "image_model=z-image-turbo" \
  -F "batch_size=2" \
  -F "style_preset=watercolor"
```

Expected: HTTP 200 with JSON containing `job queued` and `HX-Redirect` header.

- [ ] **Step 3: Check DB for events**

Within 10 seconds of the request, run:
```bash
sqlite3 silicon-seeds.sqlite "SELECT id, job_id, type, status FROM events WHERE job_id = (SELECT id FROM jobs ORDER BY created_at DESC LIMIT 1);"
```

Expected: 2 rows with `type = new_image_prompt` and `status = pending` or `running`.

- [ ] **Step 4: Confirm no zero-event active jobs remain**

Run:
```bash
sqlite3 silicon-seeds.sqlite "SELECT COUNT(*) FROM jobs j WHERE j.status = 'active' AND (SELECT COUNT(*) FROM events e WHERE e.job_id = j.id) = 0;"
```

Expected: 0 (after startup cleanup has run and before any new buggy code is introduced).

- [ ] **Step 5: Run lint and typecheck**

Run:
```bash
bun run lint
bunx tsc --noEmit
```

Expected: both pass with no errors.

---

### Task 5: Push branch and open PR

- [ ] **Step 1: Push branch**

```bash
git push origin fix/standalone-jobs
```

- [ ] **Step 2: Create PR**

```bash
gh pr create --title "fix: image jobs stuck with zero events" \
  --body "Fixes parameter misalignment in text-to-image endpoints so image events are actually scheduled. Also fails orphaned active jobs with no events on startup." \
  --base master
```

- [ ] **Step 3: Open PR in browser**

```bash
gh pr view --web
```
