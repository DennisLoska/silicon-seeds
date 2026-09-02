# Spec: Pause and Resume Job

Date: 2026-09-02
Status: draft
Topic: pause-resume-job

## Purpose
Allow user to pause an Active job (stop further dispatch, interrupt running ComfyUI execution, preserve queue state) and resume it later. Honors God and spreads truth by making long compose pipelines resumable and operator-friendly.

## Context
- Stack: Bun, Hono, Kysely + SQLite, ComfyUI via REST (/prompt, /queue, /interrupt) + WS events, SolidJS + DaisyUI frontend, DB-backed queue with priority (audio 300 > image 200 > video 100), single-slot dispatch via QueueManager.pump().
- Jobs table: status = active | complete | failed | cancelled. Events table: status = pending | running | complete | failed, priority, claimed_at, attempt_count, job_id FK.
- QueueManager.pump() picks one next Pending event where jobs.status = Active, ordered priority/index/created_at, claims it Running and dispatches to generator (ImageGenerator, VideoGenerator, AudioGenerator). Comfy executions produce WS `execution_success` path that completes event and possibly schedules follow-on events (image->video, transitions).
- Existing control: cancelJob -> job Cancelled, pending+running events -> Failed, deletes Comfy queue entries via deleteQueuedPrompts + interrupts running via interruptPrompt, holds pump during interrupt.
- ComfyUI has no native pause: only /queue GET, POST {delete: ids}, /interrupt. Pause must be emulated by interrupt + queue delete + DB state + preventing future claims.
- No current pause/resume endpoints or UI. User wants verified via cheap jobs (image generation) and real API/DB/comfy queue checks.

## Goals
- Pause: active job can be paused. Transition job.status active->paused. If running event exists, interrupt Comfy prompt, delete pending prompts of that job from comfy queue, reset Running event(s) to Pending (resumable). Pending events stay Pending but not dispatchable while paused.
- Resume: paused job resumes to Active, pump triggered, pending events become dispatchable again in original order.
- Abort-safe: pause on already completed/failed/cancelled/paused -> no-op or 409.
- Compose pipeline correctness: follow-on events that would be scheduled after current Running's success must NOT be scheduled if job paused before completion. If job paused mid-image, video generation for that image must not auto-schedule until resumed and image re-completed.
- API: POST /api/jobs/:job_id/pause, POST /api/jobs/:job_id/resume (JSON success + jobId, idempotent where sensible).
- Frontend: Jobs list/detail shows Pause/Resume buttons with status badge, optimistic SSE updates.
- Verification: cheap image job pause/resume exercised via curl + DB check + Comfy /queue + SSE.

## Non-goals
- Pausing individual events (only whole job).
- Persistent across restarts beyond DB state (bonus: paused jobs survive restart, requeueRunning must NOT auto-requeue paused running events).
- Partial progress checkpoint inside ComfyUI node graph (all-or-nothing event).
- Rate limiting, authz.

## Approach Options

### Option 1: Job-level Paused status + event requeue (recommended)
- Add JobLifecycleStatus.Paused = "paused". Keep JobStatus as is (Pending/Running/Complete/Failed). Pause: update jobs.status=paused, if Running event then interrupt + Running->Pending, delete pending comfy prompts, holdComfyIdle during interrupt then release. ClaimNextRunnable already filters jobs.status=Active so paused pending won't dispatch. Resume: jobs.status paused->active, pump().
- Pros: minimal schema, one new enum value, leverages existing filter, cheap.
- Cons: Running->Pending loses "was running" signal, but resumable; needs care to not lose attempt_count semantics (increment only on claim).

### Option 2: Job Paused + Event Paused status
- Add JobLifecycleStatus.Paused and JobStatus.Paused. Pause sets events Running|Pending -> Paused, resume Paused->Pending. Claim filter stays Active/Pending, paused events excluded explicitly.
- Pros: explicit, queryable paused events, audit trail.
- Cons: more enum churn, every query must handle new status, migration risk.

### Option 3: Global hold + job blocklist
- Reuse QueueManager.hold() with per-job blocklist Set<jobId>. Pause adds job to block set, interrupts; resume removes; no DB status change.
- Pros: no migration.
- Cons: not persistent, lost on restart, blocklist in memory, DB still says Active (confusing), breaks finalizeCompletedJobs logic.

**Recommendation:** Option 1. One new job status, no event schema change, persistent, aligns with existing Active filter, simplest to verify.

## Design

### Data Model
- Extend enum JobLifecycleStatus with Paused = "paused" in src/events/events.ts.
- DB jobs.status is text, no CHECK, so no migration needed beyond code. Optional migration to document, but not required for SQLite. If added, keep value as plain text.
- Events: no new status. Running event on pause resets to Pending (claimed_at null). Preserve attempt_count as-is (will increment again on next claim). No error string needed.

### DB Logic (src/db/db.ts)
- Jobs.pauseJob(id): transaction: select job, ensure status Active (else error), update jobs.status=paused, select events where job_id=id and status in (Pending, Running) to collect ids, update Running -> Pending (claimed_at null), return {job, runningPromptId, pendingPromptIds}. Jobs.resumeJob(id): ensure status Paused, update to Active, return job. Both notify SSE.
- Ensure failBrokenJobs and failJobsWithNoEvents ignore Paused? Currently failBrokenJobs marks Active jobs with pending/running as failed on startup - must exclude Paused. Similarly requeueRunning (QueueManager.resume) currently does Pending requeue of Running - must NOT touch Paused jobs' events (they are already Pending after pause). Adjust requeueRunning to only requeue Running where jobs.status=Active if needed. Or keep pause's Running->Pending so resume not needed.
- finalizeCompletedJobs should ignore Paused jobs (only Active -> Complete transition). Add where jobs.status=Active guard already present, so safe.

### QueueManager (src/queue/queue-manager.ts)
- Ensure pending detection respects Paused: hasRunning checks events.status Running regardless of job - but if job paused, Running already cleared, so not blocking.
- claimNextRunnable already innerJoins jobs where jobs.status=Active, so paused pending not claimed. No change needed beyond that guard.
- resume() at startup should not requeue events for paused jobs (since they are Pending now, not Running).

### ComfyUI Integration (src/comfyui/comfyui-client.ts + src/socket/socket-server.ts)
- Pause must interact with ComfyUI queue: GET /queue to inspect, POST /queue {delete: pendingPromptIds}, POST /interrupt {prompt_id: runningPromptId}. Behavior verified via cheap image job.
- SocketServer execution_success / error handlers already guard job.status != Active -> finalize + pump and early return. Add Paused to that guard: if job.status == Paused, do not schedule follow-on work (image->video, transitions, save_content deferred completion should still mark event complete? Need decision: if event completes while job paused, should we still mark complete but not schedule next? Or defer completion? Simpler: execution_success guard: if job.status != Active (i.e., Paused/Cancelled/Failed), mark event Complete but skip follow-on scheduling and pump. However that would lose video scheduling for compose jobs - image completed while paused would then never schedule video after resume unless we re-trigger. Better to keep Running->Pending on pause so completion never happens while paused - interrupt ensures no execution_success for that prompt. For non-running pending events, no completion in flight. So guard change not urgent but add Paused to the Active check.

### API (src/api/api/cancel.ts analog)
- New files src/api/api/pause.ts and src/api/api/resume.ts per existing cancel pattern.
- pause_job(c,jobId): call DB.Jobs.pauseJob, if job was Active and had runningPromptId holdForComfyIdle, deleteQueuedPrompts pending, interrupt running, releaseComfyIdle on failure, pump if no running. Return c.json({success true}). On error status not Active, return 409.
- resume_job(c,jobId): call DB.Jobs.resumeJob, pump(), return json.
- Register in src/api/api/index.ts: POST /jobs/:job_id/pause, POST /jobs/:job_id/resume.

### Frontend (SolidJS)
- src/client/pages/Jobs.tsx or job detail: add Paused badge (yellow), Pause button when Active (disabled otherwise), Resume button when Paused. Wire to fetch POST /api/jobs/:id/pause|resume, handled via SSE job-update.
- Keep existing Cancel behavior.

### Edge Cases
- Pause with no running event: just set job Paused, pending stay Pending.
- Pause idempotency: second pause on Paused -> 409 or success no-op.
- Resume when Active -> 409.
- Pause of Completed/Failed/Cancelled -> 409.
- Comfy delete/interrupt failures logged but do not rollback DB pause; job stays Paused and resumable.
- Restart while paused: job stays Paused, events Pending, not auto-dispatched until resume.

### Verification Plan (cheap jobs)
- Seed clean DB, start server (bun src/main.ts).
- Create image job via POST /api/jobs/images (text_to_image) with cheap Z-Image-Turbo 480p 1-step or API mock if Comfy not running.
- GET /api/jobs/:id and DB sqlite query to confirm Pending/Running.
- GET Comfy /queue to see prompt_id present.
- POST /api/jobs/:id/pause, assert job status paused via GET /api/jobs/:id, DB jobs.status=paused, events Running->Pending, Comfy /queue empty.
- POST /api/jobs/:id/resume, assert Active, pump triggered, event eventually Complete, artifact exists, DB finalized Complete.
- Negative: attempt pause on completed job -> 409.
- SSE: curl /jobs/stream?job_id=... sees job-update events.

### Testing
- Manual verification via bun + curl + sqlite3 + Comfy API as above. No unit test suite exists (package.json test is placeholder). Add Playwright E2E follow-up later.

## Risks
- Comfy interrupt is best-effort: if worker already finished before interrupt arrives, execution_success may race. Handled by Active guard.
- attempt_count double-increment on resume: acceptable since resume re-claim increments.

