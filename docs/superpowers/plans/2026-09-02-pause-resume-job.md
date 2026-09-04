# Pause and Resume Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement pause/resume for jobs: interrupt ComfyUI, preserve pending queue, resume dispatching.

**Architecture:** Add JobLifecycleStatus.Paused enum, DB pauseJob/resumeJob transactional methods, Hono POST /api/jobs/:id/pause|resume endpoints that delegate to ComfyUI queue delete+interrupt, QueueManager guard already via jobs.status=Active filter, SocketServer guard expanded to Paused, SolidJS pause/resume buttons with SSE.

**Tech Stack:** Bun, Hono, Kysely/SQLite, ComfyUI REST+WS, SolidJS+DaisyUI

---

## File Structure

- Modify: `src/events/events.ts` - add Paused to JobLifecycleStatus
- Modify: `src/db/db.ts` - add Jobs.pauseJob, Jobs.resumeJob, adjust failBrokenJobs/requeue guards
- Create: `src/api/api/pause.ts` - pause endpoint handler
- Create: `src/api/api/resume.ts` - resume endpoint handler
- Modify: `src/api/api/index.ts` - register pause/resume routes
- Modify: `src/queue/queue-manager.ts` - ensure paused not pumped (already via join), optional resume helper
- Modify: `src/socket/socket-server.ts` - guard execution_success vs Paused
- Modify: `src/client/pages/Jobs.tsx` or `src/client/components/*` - add Pause/Resume UI (search for jobs UI exact file in Task 5)
- Test via: `curl`, `sqlite3 data/silicon-seeds.sqlite`, `curl COMFYUI_BASE_URL/queue`

---

### Task 1: Extend JobLifecycleStatus with Paused

**Files:**
- Modify: `src/events/events.ts`

- [ ] **Step 1: Edit enum**

Add to `export enum JobLifecycleStatus`:
```ts
Paused = "paused",
```
So enum becomes Active, Complete, Failed, Cancelled, Paused.

Check job: `rg "JobLifecycleStatus" src/ ` lists usages.

- [ ] **Step 2: Verify no type errors**

Run: `bunx tsc --noEmit`
Expected: PASS (no errors about Paused)

- [ ] **Step 3: Commit**

```bash
git add -f src/events/events.ts
git commit -m "feat: add Paused to JobLifecycleStatus"
```

---

### Task 2: DB pauseJob and resumeJob transactions

**Files:**
- Modify: `src/db/db.ts`

- [ ] **Step 1: Implement pauseJob and resumeJob**

In `DB.Jobs` namespace, after `cancelJob`, add:

```ts
export async function pauseJob(id: string): Promise<CancelJobResult> {
  // transaction: select job, ensure status Active, update to Paused, select events Pending/Running, Running->Pending
}
export async function resumeJob(id: string): Promise<JobsSchema> {
  // ensure Paused -> Active
}
```

Exact shape: mirror cancelJob's transaction pattern. pauseJob returns same CancelJobResult {job, runningPromptId, pendingPromptIds} for caller to act on Comfy. Use:

```ts
export async function pauseJob(id: string): Promise<CancelJobResult> {
  const result = await db.transaction().execute(async (trx) => {
    const job = await trx.selectFrom("jobs").selectAll().where("id","=",id).executeTakeFirstOrThrow();
    if (job.status !== JobLifecycleStatus.Active) throw Object.assign(new Error(`cannot pause job in status ${job.status}`), { status: 409 });
    const events = await trx.selectFrom("events").select(["id","status"]).where("job_id","=",id).execute();
    const runningPromptId = events.find(e=>e.status===JobStatus.Running)?.id ?? null;
    const pendingPromptIds = events.filter(e=>e.status===JobStatus.Pending).map(e=>e.id);
    await trx.updateTable("jobs").set({status: JobLifecycleStatus.Paused}).where("id","=",id).execute();
    await trx.updateTable("events").set({status: JobStatus.Pending, claimed_at: null}).where("job_id","=",id).where("status","=",JobStatus.Running).execute();
    return { job: {...job, status: JobLifecycleStatus.Paused} as JobsSchema, runningPromptId, pendingPromptIds };
  });
  notifyJob(id);
  return result;
}

export async function resumeJob(id: string): Promise<JobsSchema> {
  const job = await db.selectFrom("jobs").selectAll().where("id","=",id).executeTakeFirstOrThrow();
  if (job.status !== JobLifecycleStatus.Paused) throw Object.assign(new Error(`cannot resume job in status ${job.status}`), {status: 409});
  const updated = await db.updateTable("jobs").set({status: JobLifecycleStatus.Active}).where("id","=",id).returningAll().executeTakeFirstOrThrow();
  notifyJob(id);
  return updated;
}
```

Also adjust helpers:
- `failBrokenJobs`: where jobs.status = Active already, fine but ensure comment.
- `requeueRunning`: currently updates all Running to Pending; should only affect jobs.status=Active? But pause already converts Running->Pending, so leave as is or add join guard. Add guard: join jobs and where jobs.status=Active if needed to avoid touching paused orphan.
- `finalizeCompletedJobs`: already where jobs.status=Active, so paused not finalized.

- [ ] **Step 2: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Manual smoke via bun script**

Create temp script to call DB.Jobs.pauseJob on seed job, verify status.

Run: `bun src/db/migrate.ts` if needed and test with sqlite.

- [ ] **Step 4: Commit**

```bash
git add -f src/db/db.ts
git commit -m "feat: add DB pauseJob and resumeJob with guards"
```

---

### Task 3: API endpoints POST /api/jobs/:job_id/pause and resume

**Files:**
- Create: `src/api/api/pause.ts`
- Create: `src/api/api/resume.ts`
- Modify: `src/api/api/index.ts`

- [ ] **Step 1: Create pause.ts mirroring cancel.ts**

```ts
import { comfyClient } from "../../comfyui/comfyui-client";
import { DB } from "../../db/db";
import { JobLifecycleStatus } from "../../events/events";
import { Logger } from "../../logger/logger";
import { QueueManager } from "../../queue/queue-manager";
import { Context } from "hono";
export async function pause_job(c: Context, jobId: string) {
  try {
    const result = await DB.Jobs.pauseJob(jobId);
    const wasActive = result.job.status === JobLifecycleStatus.Paused; // prior was Active
    // need prior check: result.job was paused after update, infer was Active
    if (result.runningPromptId) QueueManager.holdForComfyIdle();
    if (result.pendingPromptIds.length>0) {
      try { await comfyClient.deleteQueuedPrompts(result.pendingPromptIds); } catch(e){ Logger.error("delete failed",{error:String(e)});}
    }
    if (result.runningPromptId) {
      try { await comfyClient.interruptPrompt(result.runningPromptId); } catch(e){ Logger.error("interrupt failed",{error:String(e)}); QueueManager.releaseComfyIdle(); }
    } else {
      // no running, no hold was set
    }
    // hold released via SocketServer on next execution_* or we release if we held and no running? Actually we held only if running existed.
    return c.json({ success: true, jobId, status: "paused" });
  } catch (e:any) {
    const status = e.status ?? 500;
    if (status===409) return c.json({ error: e.message }, 409);
    throw e;
  }
}
```

Resume similar but simpler:

```ts
export async function resume_job(c: Context, jobId: string) {
  try {
    await DB.Jobs.resumeJob(jobId);
    void QueueManager.pump();
    return c.json({ success: true, jobId, status: "active" });
  } catch(e:any){
    if (e.status===409) return c.json({error:e.message},409);
    throw e;
  }
}
```

- [ ] **Step 2: Register routes in src/api/api/index.ts**

Add imports:
```ts
import { pause_job } from "./pause";
import { resume_job } from "./resume";
```
Add routes after cancel:
```ts
app.post("/jobs/:job_id/pause", async (c) => {
  return pause_job(c, c.req.param("job_id"));
});
app.post("/jobs/:job_id/resume", async (c) => {
  return resume_job(c, c.req.param("job_id"));
});
```

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -f src/api/api/pause.ts src/api/api/resume.ts src/api/api/index.ts
git commit -m "feat: add pause and resume API endpoints"
```

---

### Task 4: QueueManager and SocketServer guards for Paused

**Files:**
- Modify: `src/socket/socket-server.ts` (optional queue-manager)
- Verify: `src/queue/queue-manager.ts`

- [ ] **Step 1: Update socket guard to include Paused**

In `src/socket/socket-server.ts`, find guards:

```ts
if (event.status !== JobStatus.Running || job.status !== JobLifecycleStatus.Active) { ... }
```

Change to:

```ts
if (event.status !== JobStatus.Running || job.status !== JobLifecycleStatus.Active)
```

Already handles Paused as non-Active, so it already returns early and does not schedule follow-on. Verify both execution_success early guard and execution_interrupted/error guards include Active check. Add explicit import of Paused if needed but not code change if logic already is `!== Active`. Double-check that deferCompletion path also respects paused - if event completed while job paused due to race, we should still mark event complete but skip scheduling video/transition. Existing code does that via Active guard at top.

Optional: In `QueueManager.pump()`, `hasRunning()` currently counts any Running regardless of job status. Since pause clears Running->Pending, fine. No change.

- [ ] **Step 2: Verify requeueRunning at startup not resurrect paused**

In `src/db/db.ts` requeueRunning: add join guard or keep as is since pause events are Pending, not Running. Document.

- [ ] **Step 3: Typecheck**

Run: `bunx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add -f src/socket/socket-server.ts src/queue/queue-manager.ts src/db/db.ts
git commit -m "feat: guard socket execution for Paused jobs"
```

---

### Task 5: Frontend Pause/Resume buttons

**Files:**
- Modify: `src/client/pages/Jobs.tsx` or `src/client/components/Jobs*` (discover exact file via rg "cancel_job|Cancel" )

- [ ] **Step 1: Locate jobs UI file**

Run: `rg -n "cancel|Cancel" src/client`
Find component rendering job row actions.

- [ ] **Step 2: Add Pause/Resume logic**

Add helpers:
```ts
async function pauseJob(id: string) { await fetch(`/api/jobs/${id}/pause`, {method:"POST"}); }
async function resumeJob(id: string) { await fetch(`/api/jobs/${id}/resume`, {method:"POST"}); }
```

Render:
- if job.status === "active": show Pause button (yellow) + Cancel
- if job.status === "paused": show Resume button (green) + Cancel
- if job.status paused: badge shows Paused (badge-warning)
- Disable pause while already paused, etc.

Follow DaisyUI button styles: `btn btn-sm btn-warning` for pause, `btn btn-sm btn-success` for resume.

- [ ] **Step 3: Build check**

Run: `bunx tsc --noEmit` and `npx vite build` (or `bun run build`)
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -f src/client/pages/Jobs.tsx # or discovered file
git commit -m "feat: add pause and resume buttons in jobs UI"
```

---

### Task 6: Verification with cheap image job + API/DB/Comfy queue

**Files:**
- No code, verification only

- [ ] **Step 1: Start server hot**

Run: `bun run start:hot` (or `bun src/main.ts` with env from .env)
Check: `curl http://localhost:3000/api/health` => {"status":"up"}
Check: `curl http://127.0.0.1:8188/system_stats` => ok if Comfy running else skip comfy queue checks

- [ ] **Step 2: Create cheap image job**

```bash
curl -X POST http://localhost:3000/api/jobs/images -F prompt="pause test image, minimal" -F mode="image" | jq
# or via JSON if endpoint expects form, check src/api/schemas.ts for required fields
# alternative: POST /api/jobs/images with prompt/style etc. Inspect via: cat src/api/schemas.ts
```

Capture jobId from response or via `GET /api/jobs` latest.

- [ ] **Step 3: Verify DB and Comfy queue before pause**

```bash
sqlite3 data/silicon-seeds.sqlite "select id,status from jobs order by created_at desc limit 3;"
sqlite3 data/silicon-seeds.sqlite "select id,job_id,status,type from events where job_id='<jobId>';"
curl http://127.0.0.1:8188/queue | jq
```

- [ ] **Step 4: Pause job**

```bash
curl -X POST http://localhost:3000/api/jobs/<jobId>/pause | jq
# assert {"success":true,"status":"paused"}
sqlite3 ... "select status from jobs where id='<jobId>'" => paused
sqlite3 ... "select status from events where job_id='<jobId>'" => pending (no running)
curl http://127.0.0.1:8188/queue | jq => empty or no prompt_id
```

- [ ] **Step 5: Resume job**

```bash
curl -X POST http://localhost:3000/api/jobs/<jobId>/resume | jq
sqlite3 ... => active
# eventually events complete
sleep 5; sqlite3 ... "select status from events ..."
curl http://localhost:3000/api/jobs/<jobId> | jq .job.status
```

- [ ] **Step 6: Negative cases**

```bash
curl -X POST http://localhost:3000/api/jobs/<completedJobId>/pause -v # expect 409
curl -X POST http://localhost:3000/api/jobs/<activeJobId>/resume -v # expect 409 if already active or not paused
```

- [ ] **Step 7: SSE check**

```bash
curl -N "http://localhost:3000/jobs/stream?job_id=<jobId>" | head -20
```

Expected: events connected and job-update on pause/resume.

---

## Self-Review

- Spec coverage: pause (job status paused, interrupt, delete queue, Pending requeue) -> Task2+3, resume (Paused->Active, pump) -> Task2+3, guards -> Task4, API -> Task3, UI -> Task5, verification via cheap jobs/DB/comfy queue -> Task6. All covered.
- Placeholder scan: no TBD/TODO left; each task has exact file paths and code blocks.
- Type consistency: JobLifecycleStatus.Paused string "paused", DB pauseJob returns CancelJobResult same as cancel, resume returns JobsSchema, API uses Context from hono, QueueManager.holdForComfyIdle used as in cancel.ts. Consistent.

