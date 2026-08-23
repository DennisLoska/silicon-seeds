# HTMX Lag Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate HTMX lag on jobs detail, gallery scroll, and hypercut suggestions via batch DB, SSE debounce, streaming assets.

**Architecture:** Fix 5 files: `src/templates/jobs.tsx` (batch media), `src/sse/job-updates.ts` (debounce), `src/db/db.ts` (gallery concurrency), `src/templates/hypercut.tsx` (SSE not polling), `src/api/api.tsx` (streaming assets). Verification via `bunx tsc --noEmit`, `bun test`, curl headers.

**Tech Stack:** Bun, Hono, Kysely, SSE, HTMX, Bun.file

---

### Task 1: Batch MediaData — eliminate N+1

**Files:**
- Modify: `src/templates/jobs.tsx:1-150` (buildMediaData function)
- Modify: `src/db/db.ts` (add Jobs.listRecent if needed, keep existing list)

- [ ] **Step 1: Verify current N+1 exists**

Run:
```bash
rg -n "findByEventId" src/templates/jobs.tsx
```
Expected: `DB.Meta.findByEventId(event.id)` inside loop at ~line 100

- [ ] **Step 2: Replace buildMediaData with batch**

Edit `src/templates/jobs.tsx` `buildMediaData`:

```ts
async function buildMediaData(jobId: string): Promise<MediaData> {
  const events = await DB.Events.findByJobId(jobId);
  const mediaData: MediaData = { images: [], videos: [], audio: [], pending: [] };
  const pending = events.filter(e => e.status === "pending");
  for (const e of pending) {
    mediaData.pending.push({
      eventId: e.id, jobId: e.jobId, eventType: e.type,
      mode: e.mode, filename: "filename" in e ? (e as any).filename ?? null : null,
      status: e.status,
    });
  }
  const completedEvents = events.filter(e => e.status !== "pending");
  const ids = completedEvents.map(e => e.id);
  const metas = await DB.Meta.findManyByEventIds(ids);
  const metaById = new Map(metas.map(m => [m.event_id, m]));
  for (const event of completedEvents) {
    const meta = metaById.get(event.id);
    if (!meta) continue;
    const asset: MediaAsset = {
      eventId: event.id, jobId: event.jobId, eventType: event.type,
      filename: meta.filename, subfolder: meta.subfolder, type: meta.type, status: event.status,
    };
    const isImageFile = meta.filename?.endsWith(".png");
    if (event.mode === "image" || isImageFile) mediaData.images.push(asset);
    else if (event.mode === "video") mediaData.videos.push(asset);
    else if (event.mode === "speech" || event.mode === "song" || event.mode === "instrumental") mediaData.audio.push(asset);
  }
  return mediaData;
}
```

Keep imports same.

- [ ] **Step 3: Cap Jobs.list for sidebar (optional but include)**

In `src/db/db.ts` Jobs.list add limit param:
```ts
export async function list(limit = 100) {
  return await DB.db.selectFrom("jobs").selectAll().orderBy("created_at","desc").limit(limit).execute();
}
```
Update `jobSidebar` call sites to pass limit if needed. If no limit wanted, keep existing but add comment.

- [ ] **Step 4: Verify batch**

Run:
```bash
rg -n "findByEventId" src/templates/jobs.tsx
# expect no match (only findManyByEventIds)
rg -n "findManyByEventIds" src/templates/jobs.tsx
# expect 1 match
bunx tsc --noEmit 2>&1 | tail -20
```
Expected: no errors (fix source_video_path if shows, add to JobsSchema as optional string|null)

- [ ] **Step 5: Commit**

```bash
git add src/templates/jobs.tsx src/db/db.ts
git commit -m "fix: batch media meta fetch, cap jobs list"
```

---

### Task 2: SSE debounce + client throttle

**Files:**
- Modify: `src/sse/job-updates.ts:1-65`
- Modify: `src/templates/jobs.tsx:390-440` (hx-trigger attributes)
- Modify: `src/templates/compose.tsx:95-270` if similar throttle needed

- [ ] **Step 1: Check publish flood**

Run `rg -n "publish" src/db/db.ts | head -20` → many calls.

- [ ] **Step 2: Debounce server publish**

Edit `src/sse/job-updates.ts`:

Add debounce map:
```ts
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingJobs = new Set<string>();

export function publish(jobId: string) {
  if (debounceTimers.has(jobId)) return;
  pendingJobs.add(jobId);
  const timer = setTimeout(() => {
    debounceTimers.delete(jobId);
    if (!pendingJobs.has(jobId)) return;
    pendingJobs.delete(jobId);
    const listeners = subscribers.get(jobId);
    if (!listeners) return;
    for (const send of listeners) send("job-update", JSON.stringify({ jobId }));
  }, 300);
  debounceTimers.set(jobId, timer);
}
// Add flush for immediate completeJob
export function flush(jobId: string) {
  const t = debounceTimers.get(jobId);
  if (t) clearTimeout(t);
  debounceTimers.delete(jobId);
  pendingJobs.delete(jobId);
  const listeners = subscribers.get(jobId);
  if (!listeners) return;
  for (const send of listeners) send("job-update", JSON.stringify({ jobId }));
}
```

Update `src/db/db.ts` `completeJob` and `updateStatus` to call `flush` after? Actually `completeJob` calls `updateStatus` which already publish debounced; add flush import and call after status complete if needed. Alternative: keep publish debounced only, no flush needed — final update will still send after 300ms. Simpler keep debounce without flush.

- [ ] **Step 3: Add client throttle**

In `src/templates/jobs.tsx` change:
```tsx
hx-trigger={tab === "media" || tab === "events" ? "sse:job-update throttle:400ms" : undefined}
```
In `src/templates/compose.tsx` similarly if has `sse:job-update` add throttle:400ms.

Remove duplicate `hx-ext="sse"` from outer drawer if inner already has it: in `Jobs` component `id="job-details"` has `hx-ext="sse" sse-connect`, inner `#job-tabs-container` also triggers; keep outer, remove inner sse-connect? Actually keep one: outer `sse-connect` provides events, inner `hx-trigger` listens. Don't duplicate `sse-connect` on inner. Verify.

- [ ] **Step 4: Verify**

```bash
grep -n "throttle" src/templates/jobs.tsx | head -5
# expect 1
grep -n "debounceTimers\|publish" src/sse/job-updates.ts | head -10
bunx tsc --noEmit 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/sse/job-updates.ts src/templates/jobs.tsx src/templates/compose.tsx
git commit -m "fix: debounce SSE publish + throttle hx-trigger"
```

---

### Task 3: Gallery FS check optimization

**Files:**
- Modify: `src/db/db.ts: Gallery.listItems`
- Modify: `src/templates/gallery.tsx:64-80` sentinel

- [ ] **Step 1: Check current file exists count**

Run `grep -n "file.exists" src/db/db.ts`

- [ ] **Step 2: Reduce over-fetch and add concurrency limit**

Edit `src/db/db.ts` `Gallery.listItems`:

```ts
const results = await query.orderBy("meta.id","desc").limit(limit*2).execute(); // was *3
// concurrency 10
const concurrency = 10;
const items: Array<...> = [];
for (let i=0; i<results.length; i+=concurrency) {
  const chunk = results.slice(i, i+concurrency);
  const chunkItems = await Promise.all(chunk.map(async row=>{
    const mediaType = getMediaTypeFromExtension(row.filename);
    if (!mediaType) return null;
    const file = Bun.file(getOutputAssetPath(row.subfolder, row.filename));
    if (!(await file.exists())) return null;
    return { meta_id: row.meta_id, event_id: row.event_id, filename: row.filename, subfolder: row.subfolder, type: row.meta_type, created_at: row.event_created_at, job_id: row.job_id, mediaType };
  }));
  for (const it of chunkItems) if (it) items.push(it);
  if (items.length >= limit) break;
}
return items.slice(0, limit);
```

Add simple in-memory cache Map<string, {exists:boolean, ts:number}> with 60s TTL if wanted, but concurrency already cuts burst.

- [ ] **Step 3: Sentinel throttle**

In `src/templates/gallery.tsx` ensure sentinel has `hx-trigger="revealed once"`? Actually need infinite scroll, not once. Keep `revealed` but add `hx-indicator` and ensure OOB replacement works. Verify `renderSentinel` uses `hx-swap-oob="true"` for replacement — already.

Change sentinel class to include `hx-indicator` handling: no change needed, just verify no double fetch by checking `id="gallery-sentinel"` unique.

- [ ] **Step 4: Verify**

```bash
bunx tsc --noEmit 2>&1 | tail -10
grep -n "limit\*2" src/db/db.ts | head -