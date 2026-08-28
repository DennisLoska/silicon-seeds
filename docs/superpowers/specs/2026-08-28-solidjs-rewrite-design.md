# Spec: SolidJS SPA rewrite — replace HTMX SSR with SolidJS + Hono

Date: 2026-08-28
Branch: ref/complete-ui-rewrite
Status: approved (user requested full autonomy, no pauses)

## 1. Problem & Goal

Current UI is Hono JSX SSR + HTMX + SSE fragment fetches + Alpine + inline theme.js/handlers.js. Every tab/job interaction re-fetches HTML fragments, causes htmx lag, full-page SSR on refresh, no client-side caching, duplicate asset path logic.

Goal: remove server-side rendering (all templates, fragments, api endpoints that return HTML) and replace with SolidJS SPA while:
- Keep Hono as API server (JSON only after refactor)
- Pixel-identical look/feel (DaisyUI v5)
- Way better performance (client routing, no HTML fragment round-trips, cached API JSON)
- Keep SSE on relevant pages (jobs, compose, events, media)
- Keep DaisyUI (switch to SolidJS DaisyUI component style per https://daisyui.com/docs/install/solid/?lang=en)
- Light/Dark theme still works via SolidJS best practices (no localStorage flash, respects prefers-color-scheme, sync across tabs)
- Improve library view asset caching + compression (/gallery, /assets/*)
- Take before-screenshots for every page as review baseline; reviewer blocks unless new impl matches screenshots

Relevant pages for baseline + review: job list, individual job view, gallery view, compose view, autocut view, image view, audio view.

## 2. Non-goals

- No SolidStart / SSR inside Solid — pure SPA (Vite build output served as static by Hono)
- No auth / user system in this change
- No change to DB schema, queue, LLM/ComfyUI pipelines (only HTTP layer)
- No redesign — 1:1 visual parity, not new UX

## 3. Current Architecture (to be removed)

- `src/templates/*` — Layout, App shell, Dashboard, Compose, Gallery, Jobs, Media, Events, Status, Settings, etc. (Hono JSX)
- `src/api/api.tsx` — `Api.renderFragment` (HX-Request check, OOB swaps)
- Route groups returning HTML: `src/api/dashboard`, `compose`, `create/*`, `gallery`, `jobs/jobs.tsx`, `settings`, `fragments/*`
- Static handlers.js/theme.js/alpine relying on HTMX lifecycle
- typed-htmx attributes throughout templates

Keep: `src/api/api/index.ts` (JSON job APIs), `health.ts`, `sse/job-updates.ts`, static serving + /assets handler (will be improved)

## 4. Target Architecture

### 4.1 Build & Serving

- Vite + vite-plugin-solid as frontend toolchain. Source in `src/client/` (or `client/` at root — pick `src/client` to keep monorepo simple).
- `vite build` → `dist/client/` (or `static/client/`). Hono serves built JS/CSS/assets via existing `/static/*` handler + new SPA fallback: `GET /*` that is not `/api/*`, `/jobs/*`, `/assets/*`, `/static/*` → serve `index.html` (client router handles).
- Dev: `vite dev` proxy to Hono (port 3000) OR run both — prefer `vite --port 5173` proxying `/api` + `/assets` + `/jobs/stream` to `localhost:3000` so HMR works without losing API.
- Tailwind v4 stays, but `src/templates/app.css` moves to `src/client/index.css` and is imported via Vite. `bun run build:css` replaced by Vite CSS pipeline, but keep script for CI until cutover.

### 4.2 Routing (solid-router or @solidjs/router)

- File: `src/client/router.tsx`
- Routes mirror current pages (client-side only):
  - `/` and `/dashboard`
  - `/jobs` (list) + `/jobs/:jobId` with query `?tab=status|media|events` + filter
  - `/gallery` with `?type=all|image|video`
  - `/compose`
  - `/create/image`, `/create/video`, `/create/audio`, `/create/autocut`, `/create/text`
  - `/settings`
- 404 → NotFound component.
- After refactor, old SSR GET routes return 404 or redirect; API keeps JSON.

### 4.3 Data Layer

- Hono JSON APIs remain / are normalized:
  - Keep SSE at `GET /jobs/stream?job_id=...` (EventSource in Solid).
  - Existing JSON: `POST /api/jobs/...`, `GET /api/health`, gallery list, jobs list, events, media-items. Normalize what templates currently fetch as HTML into JSON endpoints:
    - `GET /api/jobs` → list jobs (already exists via DB.Jobs.list)
    - `GET /api/jobs/:jobId` + `?tab` queries replaced by client composing from JSON: job + events + media
    - New/keep JSON endpoints: `GET /api/gallery/items?cursor=&limit=&type=`, `GET /api/jobs/:jobId/events?offset=&limit=&source=`, `GET /api/jobs/:jobId/media?type=&offset=&limit=`, `GET /api/jobs/:jobId/compose-progress`, etc. OR generic: `GET /api/jobs` + `GET /api/jobs/:id` + `GET /api/jobs/:id/events` + `GET /api/gallery/items`. Prefer reusing `DB.Gallery.listItems` / `DB.Events.*` via JSON wrappers.
- Client fetch layer: `src/client/api/client.ts` using `fetch` + zod validation (existing `src/api/schemas.ts` reused). Cache headers respected (ETag).
- No tanstack-query — use Solid `createResource` + manual cache map keyed by query params. Gallery infinite scroll via `createSignal` cursor.

### 4.4 SSE Integration (keep)

- `src/client/lib/sse.ts` — tiny wrapper around `EventSource` for `job-update` events.
- Pages that need live updates (Jobs detail tabs, Compose progress, Image/Audio progress) subscribe when `jobId` set, close on cleanup (`onCleanup`). On `job-update`, refetch relevant `createResource`.
- Keep server `JobUpdates.publish` debounced 300ms — no change.
- Verify SSE still works for compose, autocut, image, audio — all job-bound.

### 4.5 Components & DaisyUI

- Install per https://daisyui.com/docs/install/solid/?lang=en : `solid-js` + `daisyui` already present, add `vite-plugin-solid` + `solid-js` peer. DaisyUI Solid components are just Tailwind classes — use `daisyui` classes directly in JSX (no extra npm component lib needed; docs show utility-first usage). Keep Tailwind v4 + DaisyUI v5.
- Shared layout: `src/client/components/Layout.tsx` + `Sidebar.tsx` + `Header.tsx` — port `src/templates/app.tsx` + `layout.tsx` to Solid. Preserve drawer (`lg:drawer-open`), bumblebee/dracula theme, sidebar links using `A` from solid-router instead of `hx-get`.
- Page components 1:1 with screenshots:
  - `Dashboard`
  - `JobsList` + `JobDetails` + tabs `StatusTab`/`MediaTab`/`EventsTab`
  - `Gallery` + gallery infinite scroll + sentinel + `renderItems` equivalent as Solid component
  - `Compose` (script textarea, style_guide, generation settings cards, progress)
  - `AutoCut` (upload + transcribed plan)
  - `CreateImage`, `CreateVideo`, `CreateAudio`, `CreateText`
  - `Settings`
- Theme: Solid `createSignal` + `createEffect` that writes `data-theme` to `document.documentElement`, persists to `localStorage["theme"]`, reads on mount (avoid flash — inline script in `index.html` same as current `layout.tsx` does, ported to Vite `index.html`). Validates values to bumblebee/dracula only, listens to `storage` event for cross-tab sync, uses `matchMedia("(prefers-color-scheme: dark)")` fallback. No `@theme` Flash.

### 4.6 Performance & Caching

- Client routing eliminates fragment fetches → instant tab switches.
- `createResource` dedup + manual `Map` cache for gallery items; `max-age` via server Cache-Control.
- Keep/extend Hono static + /assets handlers: ETag + `Cache-Control: public, max-age=3600` (/static) and `immutable` (/assets), gzip for text/* + json/js/css/svg >1KB, Range support for media. Library view adds: `/api/gallery/items` returns `Cache-Control: public, max-age=60` + ETag; client respects 304. Asset `<img>`/`<video>` tags in Solid use `loading="lazy"` + `decoding="async"`.
- Vite build emits hashed filenames → long-term caching automatically; Hono serves them with `immutable`.

### 4.7 Error Handling

- API errors return JSON `{error, code}` consistently; client shows `Toast` component (port `templates/toast.tsx`) via global store `src/client/stores/toast.ts`.
- SSE `EventSource.onerror` → exponential backoff reconnect; show stale indicator.
- Empty states mirror current: "No jobs found", "No more items", "No job selected".

## 5. Migration Plan (first-principles SolidJS)

- SolidJS reactivity is fine-grained signals — no VDOM diff, no useEffect deps. Use `createSignal` for local state, `createResource` for async, `createEffect` only for side-effects (theme, SSE subscription). Avoid `createMemo` unless derived hot path.
- No `useState` batching footguns — writes are synchronous signals; use `batch` only when updating multiple signals together.
- Keep components small, props-typed, no prop drilling via context for jobId/theme.
- Remove `typed-htmx`, `alpine`, `htmx.min.js`, `htmx-ext-sse.min.js` after SPA lands.

## 6. File Map (create / modify / delete)

Create:
- `src/client/index.html` (Vite entry), `src/client/index.tsx` (mount), `src/client/router.tsx`, `src/client/index.css`
- `src/client/api/client.ts`, `src/client/lib/sse.ts`, `src/client/lib/utils.ts`
- `src/client/components/Layout.tsx`, `Sidebar.tsx`, `Header.tsx`, `Toast.tsx`, `Icons.tsx` (port)
- `src/client/pages/Dashboard.tsx`, `Jobs.tsx`, `Gallery.tsx`, `Compose.tsx`, `AutoCut.tsx`, `CreateImage.tsx`, `CreateVideo.tsx`, `CreateAudio.tsx`, `CreateText.tsx`, `Settings.tsx`
- `src/client/stores/theme.tsx`, `stores/jobs.ts`, `stores/gallery.ts`
- `vite.config.ts`

Modify:
- `src/api/api.tsx` — keep only JSON + static + SPA fallback; remove `renderFragment` / HTMX branching
- `package.json` — add `solid-js`, `@solidjs/router`, `vite`, `vite-plugin-solid`; remove `typed-htmx` after
- `src/main.ts` — no template import changes except serving built client

Delete after verification:
- `src/templates/*`
- `src/api/dashboard`, `compose`, `create/*` (HTML parts), `gallery` (HTML parts), `jobs/jobs.tsx` (HTML parts), `fragments/*`, `settings` (HTML parts) — keep only JSON handlers
- `static/htmx.min.js`, `static/htmx-ext-sse.min.js`, `static/alpine.min.js`, `static/handlers.js`, `static/theme.js` (replaced by Vite bundle)

## 7. Validation: Baseline Screenshots

Before any code change, capture screenshots for every page at `http://localhost:3000` on current branch (HTMX version). Store under `docs/superpowers/screenshots/2026-08-28-baseline/`:

- `01-dashboard.png` — `/` + `/dashboard`
- `02-jobs-list.png` — `/jobs`
- `03-job-detail.png` — `/jobs/details/:jobId?tab=status` (use latest job or empty state)
- `04-gallery.png` — `/gallery`
- `05-compose.png` — `/compose`
- `06-autocut.png` — `/create/autocut`
- `07-image.png` — `/create/image`
- `08-audio.png` — `/create/audio` (covers song creation; label as audio view)
- `09-text-video-settings` — `/create/text`, `/create/video`, `/settings` if not covered but reviewer only requires 7 listed pages; capture extra for safety

Capture at 1280x800, light theme (bumblebee) then optionally dark (dracula) toggle to prove theme works. Implementation blocked until all screenshots exist.

Review gate: n parallel reviewers (one per page) compare post-refactor DOM/screenshot to baseline; block unless pixel/perceptual match within tolerance (layout, colors, DaisyUI components identical). Light/Dark both must work.

## 8. Success Criteria

- Hono still serves all JSON APIs + SSE; no regression in job pipelines (compose, autocut, image, audio) — verify via `curl` + `bun start:hot`
- SPA navigation is instant, no HTMX fragment fetches, no full reloads on tab/job switches
- `bunx tsc --noEmit` clean, `bun run lint` clean, `bun run build` (vite) succeeds
- Screenshots before/after exist; n reviewers PASS
- Theme toggle persists, respects system pref, cross-tab sync, no flash on reload (Solid best practices)
- Gallery caching/compression: verify via `curl -I /assets/<file>` headers + vite hashed assets

## 9. Risks & Mitigations

- SSE reconnect under HMR — isolate EventSource cleanup in `onCleanup`
- Asset paths `/assets/<filename>` still resolve after SPA fallback — mount static before fallback route, ensure `OUTPUT_DIR` env
- Vite + Bun interop — use `vite` as dev dep, not bun-specific plugin; proxy config points to `localhost:3000`

## 10. Open Questions

None — user gave explicit scope. If any new ambiguity emerges, prefer SolidJS docs + DaisyUI docs via context7 and preserve current behavior exactly.
