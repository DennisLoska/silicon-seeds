# HTMX Lag + Remaining Issues — Design

## 2026-08-23

## Problem

After gallery perf (cache+ETag+gzip) + hypercut render robustness merge (9bd82e6), HTMX lag remains on 3 surfaces:

**A. Jobs detail tabs — SSE thrash + N+1 queries**
- `src/templates/jobs.tsx: buildMediaData()` loops `events` then per-event `DB.Meta.findByEventId()` → N queries. Job with 50 events → 50 sequential DB hits per `sse:job-update`.
- `src/api/jobs/jobs.tsx` `/jobs/details/:jobId` does outerHTML swap of whole `#job-tabs-container` on every `sse:job-update` (media/events tabs). Each swap re-fetches job + events + media. No debounce. Rapid event creation (queue processing) floods client.
- `DB.Jobs.list()` loads all jobs unpaginated, filters in-memory for sidebar. Large job count → slow sidebar.
- `src/templates/jobs.tsx` sidebar uses `hx-target="#job-content-container"` on row click but also details page uses SSE outerHTML — double SSE connections (one on `#job-details` drawer, one on inner container).

**B. Gallery infinite scroll — sentinel + file checks**
- `src/db/db.ts: Gallery.listItems` does `limit*3` fetch + `Promise.all(file.exists())` per row → up to 60 FS stat calls per scroll page. Each `Bun.file.exists()` hits disk. No caching.
- `src/templates/gallery.tsx` sentinel `hx-trigger="revealed"` can fire repeatedly if scroll fast; `hx-swap="afterend"` + OOB column append may cause layout thrash (5 columns).

**C. Hypercut polling — 5s forever**
- `src/templates/hypercut.tsx: HypercutWorkspace` suggestions panel uses `hx-trigger="load, every 5s"` polling suggestions forever, even after job complete. No SSE. Causes 12 req/min per workspace open. Should use SSE `job-update` instead.

**D. Remaining issues (from gallery+hypercut merge)**
- No pagination limit on jobs list (sidebar).
- No batch Meta fetch (already exists `findManyByEventIds` but not used).
- No debounce/throttle on `JobUpdates.publish` — called per event status change + per meta insert → bursty.
- `src/api/api.tsx` `/assets/*` still uses `await file.arrayBuffer()` for full files (loads whole video into memory) despite Range support.

## Goals

1. Jobs media/events tab lag <200ms perceived after SSE (batch DB, no N+1, debounce).
2. Gallery scroll smooth, no duplicate fetches, FS checks cached or limited.
3. Hypercut suggestions update via SSE, no polling after 5s.
4. Assets serve without loading whole video into RAM for 200 responses (use Bun.file streaming where possible).
5. `bunx tsc --noEmit` green, `bun test` green, curl headers still pass.

## Non-goals

- No new job pagination UI (keep simple limit, defer UI work).
- No WebSocket replacement (keep SSE).
- No thumbnail generation (defer).
- No CDN.

## Architecture

### Component 1: Jobs media batch fetch

Replace `buildMediaData` N+1 with batch:

```ts
const events = await DB.Events.findByJobId(jobId)
const pending = events.filter(e=>e.status==='pending')
const completedIds = events.filter(e=>e.status!=='pending').map(e=>e.id)
const metas = await DB.Meta.findManyByEventIds(completedIds)
const metaByEventId = new Map(metas.map(m=>[m.event_id, m]))
// then build mediaData synchronously
```

Add `DB.Events.findByJobId` already exists, use `findManyByEventIds`.

Add `DB.Jobs.list(limit=100)` param or new `listRecent(limit)` to cap sidebar. Keep filter in SQL where possible (status filter) instead of in-memory.

### Component 2: SSE debounce

In `src/sse/job-updates.ts`, debounce publish per jobId:

- Keep `Map<jobId, timeout>`; `publish(jobId)` schedules send after 300ms, coalescing bursts.
- Alternatively client-side `hx-trigger="sse:job-update throttle:500ms"` but HTMX throttle not debounce — prefer server debounce.

Client change: `src/templates/jobs.tsx` `#job-tabs-container` use `hx-trigger="sse:job-update throttle:400ms"` to avoid flood if server not debounced.

Split `#job-details` outer SSE connection: only inner container should have `sse-connect`. Remove duplicate `hx-ext="sse"` from outer drawer if inner already has it.

### Component 3: Gallery FS check optimization

In `DB.Gallery.listItems`:
- After filtering by mediaType via filename ext (SQL `like`), still do file.exists but with concurrency limit (p-limit 10) or cache `Map<path, boolean>` with TTL 60s.
- Reduce over-fetch from `limit*3` to `limit*2` (40 vs 60) since file-missing rate low.
- Add index on `meta.type` + `meta.id` if missing (check migrations).

Template: sentinel uses `hx-trigger="revealed once"` or add `hx-vals` with cursor, ensure `renderSentinel` returns sentinel with `id="gallery-sentinel"` unique and `hx-swap-oob` correctly replaces previous sentinel (already done via OOB). Add `data-loading-delay` or `hx-indicator` to avoid double fetch.

### Component 4: Hypercut polling → SSE

In `src/templates/hypercut.tsx`:
- Replace `hx-trigger="load, every 5s"` with SSE: add `hx-ext="sse" sse-connect="/jobs/stream?job_id=${jobId}" hx-trigger="sse:job-update"` plus initial `load` trigger.
- Keep `load` for first fetch, remove `every 5s`.
- Same for `HypercutJobStatus` already uses SSE — keep.

### Component 5: Assets streaming

In `src/api/api.tsx` `/assets/*` handler for 200 non-range:
- Return `new Response(file as unknown as BodyInit, { headers })` directly instead of `await file.arrayBuffer()` when not compressing. This streams from disk via Bun.file.
- Only `arrayBuffer()` when compressing (needs bytes) or when range slice (already uses slice).
- Keep gzip path for compressible types only.

## Data Flow

Job event created → `DB.Events.create` → `notifyJob(jobId)` → `JobUpdates.publish` (debounced 300ms) → SSE `job-update` → HTMX `hx-get /jobs/details/:jobId?tab=...` (throttled 400ms) → server batch fetch `events + metas batch` → render fragment → swap outerHTML.

Gallery scroll → sentinel revealed → `/gallery/items?cursor=...` → `Gallery.listItems` (SQL limit*2 + ext filter + file.exists with concurrency 10 + cache) → `renderItems` → OOB column append + sentinel replace.

Hypercut workspace open → `load` fetch suggestions → SSE `job-update` on each transcription/suggestion insert → hx-get suggestions → swap innerHTML.

Assets request → `/assets/*` → ETag check → Range check → if range: slice+206 → else if compressible+accepts gzip: arrayBuffer+compress → else streaming file response with cache headers.

## Error Handling

- Batch fetch: if `findManyByEventIds` returns missing meta, skip asset (same as before).
- Debounce: ensure `publish` after job complete still sends final update (flush timeout on `completeJob`).
- Gallery file missing: same as before, filtered out; if all filtered, return "No more items".
- SSE: keep `keep-alive` 15s, cleanup on cancel, same as existing.
- Assets: if compress fails, fallback to streaming uncompressed.

## Testing

- `bunx tsc --noEmit` passes after changes.
- `bun test` — existing hypercut tests pass; no new tests but add optional `jobs.test.ts` for batch logic if time.
- Manual curl: `curl -H "Accept-Encoding: gzip" -I /static/style.css` still gzip, `curl -I /assets/...png` still 200 with Cache-Control.
- Manual HTMX: open jobs page with `job_id` and switch media tab, verify network: one `job-update` → one `hx-get`, not flood.
- Gallery: scroll fast, verify sentinel fires once per page, no duplicate cursors.
- Hypercut: open workspace, verify no `every 5s` polling in network (only SSE + job-update driven).

## Success Criteria

- `buildMediaData` uses single `findManyByEventIds` call (grep confirms no looped `findByEventId`).
- `DB.Gallery.listItems` does at most 40 file checks per page (was 60), with concurrency limit.
- `HypercutWorkspace` `hx-trigger` no longer contains `every 5s`.
- `JobUpdates.publish` debounced (or client throttle added).
- `/assets/*` 200 path returns streaming `Bun.file` when not compressed (grep `arrayBuffer` only in compress/range branches).
- `bunx tsc --noEmit` green, `bun test` green.
- Remaining merge commit history preserved (no rewrite).

## Open Questions

- Debounce interval: 300ms server + 400ms client throttle — tune after manual test.
- Sidebar job limit: 100 — enough for now.
