# SolidJS SPA Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace HTMX SSR with SolidJS SPA while keeping Hono, DaisyUI, SSE, pixel-identical UI, faster perf, proper caching/compression, and correct light/dark theme via SolidJS best practices.

**Architecture:** Vite + SolidJS SPA in `src/client/` built to `dist/client/` (or `static/client/`), served by Hono with SPA fallback. Hono JSON APIs + SSE stay, HTML fragment routes removed. Solid Router for client navigation, `createResource` + EventSource for SSE live pages, DaisyUI classes directly, theme via Solid signal + inline anti-flash script + localStorage + matchMedia + storage event.

**Tech Stack:** SolidJS, @solidjs/router, Vite + vite-plugin-solid, Hono, DaisyUI v5, Tailwind v4, SSE (EventSource), Bun, Kysely/SQLite

---

### Task 0: Baseline Screenshots Gate (BLOCKS ALL OTHER TASKS)

**Files:**
- Create: `docs/superpowers/screenshots/2026-08-28-baseline/*.png` (01-dashboard … 09-settings)

**Precondition:** Server running at `http://localhost:3000` on current HTMX branch, seeded data if possible. No code changes until screenshots verified.

- [ ] **Step 1: Start server**
```bash
bun db:migrate 2>&1 | tail -20
bun run build:css 2>&1 | tail -20
bun start:hot &
sleep 5; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```

- [ ] **Step 2: Capture screenshots via chrome-devtools MCP (or Playwright)**

Pages to capture at 1280x800, light theme (bumblebee default):
1. `01-dashboard.png` — `GET /` and `/dashboard`
2. `02-jobs-list.png` — `GET /jobs` (with and without jobs)
3. `03-job-detail-status.png` — `GET /jobs/details/:jobId?tab=status` (or empty state if no jobs)
4. `03b-job-detail-media.png` — `?tab=media`
5. `03c-job-detail-events.png` — `?tab=events`
6. `04-gallery.png` — `GET /gallery` and `/gallery?type=image`
7. `05-compose.png` — `GET /compose`
8. `06-autocut.png` — `GET /create/autocut`
9. `07-image.png` — `GET /create/image`
10. `08-audio.png` — `GET /create/audio`
11. `09-text-video-settings.png` — `GET /create/text`, `/create/video`, `/settings`

Optional dark: toggle to dracula and re-capture 01,02,04 to prove theme.

Use:
```ts
// chrome-devtools MCP
await chrome-devtools_navigate_page({pageId, type:"url", url:"http://localhost:3000/gallery"})
await chrome-devtools_take_screenshot({pageId, fullPage:false})
await chrome-devtools_take_snapshot({pageId}) // verify DOM
```
Or Playwright `bunx playwright` helper.

- [ ] **Step 3: Verify all 9+ screenshots exist**
```bash
ls -lh docs/superpowers/screenshots/2026-08-28-baseline/
# expect 9+ pngs, non-zero bytes. If missing, re-capture before proceeding.
```

- [ ] **Step 4: Commit baseline**
```bash
git add -f docs/superpowers/screenshots/2026-08-28-baseline/
git commit -m "docs: baseline screenshots for SolidJS rewrite review gate"
```

**Gate:** If any screenshot missing, implementation subagents MUST NOT start. Main reports blocked.

---

### Task 1: Vite + SolidJS Scaffold + Hono Static/SPA Plumbing

**Files:**
- Create: `vite.config.ts`, `src/client/index.html`, `src/client/index.tsx`, `src/client/index.css` (port of `src/templates/app.css`), `src/client/App.tsx`
- Modify: `package.json`, `src/api/api.tsx`, `src/main.ts` (if needed), `tsconfig.json`

- [ ] **Step 1: Install deps**
```bash
bun add solid-js @solidjs/router
bun add -d vite vite-plugin-solid
bunx tsc --noEmit 2>&1 | head -n 50
```

- [ ] **Step 2: Create vite.config.ts**
```ts
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
export default defineConfig({
  plugins: [solid()],
  root: "src/client",
  build: { outDir: "../../dist/client", emptyOutDir: true },
  server: { port: 5173, proxy: {
    "/api": "http://localhost:3000",
    "/assets": "http://localhost:3000",
    "/jobs/stream": "http://localhost:3000",
    "/jobs": { target: "http://localhost:3000", changeOrigin: true },
    "/gallery/items": "http://localhost:3000",
  }},
});
```

- [ ] **Step 3: Create src/client/index.html (with anti-flash theme script)**
```html
<!doctype html>
<html lang="en">
<head>
  <script>(function(){var k="theme",l="bumblebee",d="dracula",t=null;try{t=localStorage.getItem(k)}catch(e){}if(t!==d&&t!==l){try{t=window.matchMedia("(prefers-color-scheme: dark)").matches?d:l}catch(e){t=l}}document.documentElement.setAttribute("data-theme",t)})();</script>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Silicon Seeds</title>
</head>
<body><div id="root"></div><script type="module" src="/index.tsx"></script></body>
</html>
```

- [ ] **Step 4: Create src/client/index.tsx + App.tsx + index.css**
```tsx
// index.tsx
import { render } from "solid-js/web";
import App from "./App";
import "./index.css";
render(() => <App />, document.getElementById("root")!);
```
```tsx
// App.tsx placeholder — router added in Task 2, for now static shell
export default function App(){ return <div>Silicon Seeds SolidJS</div>; }
```
Copy `src/templates/app.css` → `src/client/index.css` (keep @import tailwind + daisyui).

- [ ] **Step 5: Modify Hono to serve SPA build + keep static/assets**
In `src/api/api.tsx`: after `/static/*` and `/assets/*` handlers, add Vite dev proxy bypass and production SPA fallback:
```ts
// serve built client in production
app.use("/*", async (c, next) => {
  if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/assets/") || c.req.path.startsWith("/static/") || c.req.path.startsWith("/jobs/stream")) return next();
  // try file in dist/client for non-API routes
  const file = Bun.file(`dist/client${c.req.path === "/" ? "/index.html" : c.req.path}`);
  if (await file.exists() && !c.req.path.includes(".")) { /* fallthrough to index.html */ }
  // always serve index.html for SPA routes
  const index = Bun.file("dist/client/index.html");
  if (await index.exists()) return new Response(index as unknown as BodyInit, { headers: {"Content-Type":"text/html"}});
  return next();
});
```
For dev, rely on `vite` proxy; in production serve `dist/client`.

Simpler: just add fallback after all routes that serves `dist/client/index.html` for GET without extension.

- [ ] **Step 6: Verify build**
```bash
bunx vite build 2>&1 | tail -30
ls -lh dist/client/ 2>&1 | head -n 30
bunx tsc --noEmit 2>&1 | tail -20
```

- [ ] **Step 7: Commit**
```bash
git add vite.config.ts src/client/ package.json src/api/api.tsx
git commit -m "feat(client): Vite + SolidJS scaffold + Hono SPA plumbing"
```

---

### Task 2: Router + Layout/Sidebar/Header + Theme + DaisyUI Parity

**Files:**
- Create: `src/client/router.tsx`, `src/client/components/Layout.tsx`, `src/client/components/Sidebar.tsx`, `src/client/components/Header.tsx`, `src/client/components/Icons.tsx` (port `src/templates/icons.tsx`), `src/client/stores/theme.tsx`, `src/client/components/Toast.tsx`
- Modify: `src/client/App.tsx`, `src/client/index.css` if needed

- [ ] **Step 1: Port icons**
Copy `src/templates/icons.tsx` to `src/client/components/Icons.tsx` (change `Child` to Solid JSX, keep SVG).

- [ ] **Step 2: Implement theme store (Solid best practice)**
```tsx
// src/client/stores/theme.tsx
import { createSignal, createEffect, onMount } from "solid-js";
const THEMES = ["bumblebee","dracula"] as const;
type Theme = typeof THEMES[number];
function getInitial(): Theme {
  try { const v=localStorage.getItem("theme"); if(THEMES.includes(v as any)) return v as Theme; } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dracula":"bumblebee";
}
export function createTheme(){
  const [theme,setTheme]=createSignal<Theme>(getInitial());
  createEffect(()=>{ const t=theme(); document.documentElement.setAttribute("data-theme",t); try{localStorage.setItem("theme",t)}catch{} });
  onMount(()=>{
    const h=(e:StorageEvent)=>{ if(e.key==="theme" && e.newValue && THEMES.includes(e.newValue as any)) setTheme(e.newValue as Theme); };
    window.addEventListener("storage",h);
    return ()=>window.removeEventListener("storage",h);
  });
  return {theme,setTheme,toggle:()=>setTheme(t=>t==="bumblebee"?"dracula":"bumblebee")};
}
```

- [ ] **Step 3: Layout/Sidebar/Header (port src/templates/app.tsx + layout.tsx)**
Preserve: `drawer lg:drawer-open min-h-screen bg-base-100`, `drawer-toggle`, `drawer-content`, `navbar bg-base-200 px-4 shadow-sm`, `drawer-side`, `is-drawer-close:w-20 is-drawer-open:w-64 bg-base-200 border-r`, `menu menu-md`, `swap swap-rotate theme-controller`, `btn btn-ghost btn-circle`. Use `A` from `@solidjs/router` instead of `hx-get`. Keep `id` attributes for targeting (`sidebar-*`, `header-title`, `job-content-container`, `main-drawer`).

- [ ] **Step 4: Router + App**
```tsx
// router.tsx
import { Router, Route } from "@solidjs/router";
import Layout from "./components/Layout";
export default function AppRouter(){ return <Router root={Layout}>
  <Route path="/" component={lazy(()=>import("./pages/Dashboard"))} />
  <Route path="/dashboard" component={lazy(()=>import("./pages/Dashboard"))} />
  <Route path="/jobs" component={lazy(()=>import("./pages/Jobs"))} />
  <Route path="/jobs/:jobId" component={lazy(()=>import("./pages/Jobs"))} />
  <Route path="/gallery" component={lazy(()=>import("./pages/Gallery"))} />
  <Route path="/compose" component={lazy(()=>import("./pages/Compose"))} />
  <Route path="/create/image" component={lazy(()=>import("./pages/CreateImage"))} />
  <Route path="/create/video" component={lazy(()=>import("./pages/CreateVideo"))} />
  <Route path="/create/audio" component={lazy(()=>import("./pages/CreateAudio"))} />
  <Route path="/create/autocut" component={lazy(()=>import("./pages/AutoCut"))} />
  <Route path="/create/text" component={lazy(()=>import("./pages/CreateText"))} />
  <Route path="/settings" component={lazy(()=>import("./pages/Settings"))} />
</Router>; }
```

- [ ] **Step 5: Visual check (DOM)**
```bash
bunx vite build && bun start:hot & sleep 4; curl -s http://localhost:3000/ | head -n 50
# chrome-devtools snapshot: compare Layout DOM to baseline screenshots
```

- [ ] **Step 6: Commit**
```bash
git add src/client/
git commit -m "feat(client): Solid router + Layout/Sidebar/Header + theme (DaisyUI parity)"
```

---

### Task 3: Hono JSON APIs (normalize HTML → JSON) + SSE keep

**Files:**
- Modify: `src/api/api.tsx` (remove renderFragment), `src/api/jobs/jobs.tsx` → split into JSON, `src/api/gallery/index.tsx`, `src/api/compose/index.tsx`, `src/api/create/*`, `src/api/dashboard/*`, `src/api/settings/*`, `src/api/fragments/*` (delete or JSON-only)
- Create: `src/api/json.ts` helpers (if needed)
- Test: `src/api/client.test.ts` or manual curl

- [ ] **Step 1: Remove Api.renderFragment**
Delete `renderFragment` + `OobHeader` HTMX branching from `src/api/api.tsx`. Keep static/assets/SSE.

- [ ] **Step 2: JSON endpoints**

For each page route, ensure JSON exists (add if missing):
```ts
// GET /api/jobs?filter=all              → DB.Jobs.list()
// GET /api/jobs/:jobId                  → DB.Jobs.findById + DB.Events.findByJobIdChronological + meta
// GET /api/jobs/:jobId/events?offset=&limit=&source=
// GET /api/jobs/:jobId/media?type=image|video|audio&offset=&limit=
// GET /api/gallery/items?cursor=&limit=20&type=image|video
// GET /api/health, POST /api/jobs/videos/compose etc. already JSON — keep
```
Response shape mirrors what templates previously used, but JSON. Add `Cache-Control: public, max-age=60, must-revalidate` + ETag for gallery/media lists.

Keep `GET /jobs/stream?job_id=` SSE exactly as before (no change to `src/sse/job-updates.ts` except verify headers).

- [ ] **Step 3: Client API helper**
```ts
// src/client/api/client.ts
export async function apiGet<T>(path:string):Promise<T>{
  const r=await fetch(path, {headers:{"Accept":"application/json"}});
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}
export function sseUrl(jobId:string){ return `/jobs/stream?job_id=${encodeURIComponent(jobId)}`; }
```

- [ ] **Step 4: Verify via curl**
```bash
curl -s http://localhost:3000/api/health | head
curl -s "http://localhost:3000/api/gallery/items?limit=5" | head
curl -s "http://localhost:3000/jobs/stream?job_id=test" --max-time 2 -H "Accept: text/event-stream" | head
bunx tsc --noEmit
```

- [ ] **Step 5: Commit**
```bash
git add src/api/
git commit -m "feat(api): normalize to JSON (remove SSR fragments), keep SSE"
```

---

### Task 4: Dashboard Page

**Files:**
- Create: `src/client/pages/Dashboard.tsx`
- Port: `src/templates/dashboard.tsx`

- [ ] **Step 1: Port component**
Solid component fetching `GET /api/jobs` via `createResource`, rendering same DaisyUI cards/stats. No SSE on dashboard (or optional). Match baseline `01-dashboard.png` pixel-for-pixel (Tailwind classes identical).

- [ ] **Step 2: Verify DOM vs screenshot**
Chrome snapshot + screenshot compare.

- [ ] **Step 3: Commit**
```bash
git add src/client/pages/Dashboard.tsx
git commit -m "feat(client): Dashboard page (SolidJS port)"
```

### Task 5: Jobs List + Job Detail (SSE)

**Files:**
- Create: `src/client/pages/Jobs.tsx`, `src/client/components/JobTabs.tsx`, `src/client/components/EventList.tsx`, `src/client/components/MediaGrid.tsx`, `src/client/lib/sse.ts`
- Port: `src/templates/jobs.tsx`, `events-list.tsx`, `media.tsx`, `status.tsx`, `events.tsx`

- [ ] **Step 1: sse lib**
```ts
// src/client/lib/sse.ts
export function useJobUpdates(jobId:()=>string|null, onUpdate:()=>void){
  let es:EventSource|null=null;
  createEffect(()=>{ const id=jobId(); if(!id){es?.close(); es=null; return;}
    es?.close(); es=new EventSource(sseUrl(id));
    es.addEventListener("job-update",onUpdate);
    es.onerror=()=>{ es?.close(); setTimeout(()=>onUpdate(),1000); };
  });
  onCleanup(()=>es?.close());
}
```

- [ ] **Step 2: Jobs page with tabs (status/media/events)**
Fetch jobs list + selected job via `createResource`. Tabs use query `?tab=` + router params, `A` links. On `job-update` SSE, refetch `createResource`. Must match `02-jobs-list.png`, `03-*.png`.

- [ ] **Step 3: Verify SSE live**
Trigger job update via POST or DB publish, check EventSource receives `job-update`.

- [ ] **Step 4: Commit**
```bash
git add src/client/pages/Jobs.tsx src/client/components/ src/client/lib/sse.ts
git commit -m "feat(client): Jobs list+detail with SSE tabs"
```

### Task 6: Gallery (caching, compression, lazy, infinite scroll)

**Files:**
- Create: `src/client/pages/Gallery.tsx`, `src/client/components/GalleryCard.tsx`
- Port: `src/templates/gallery.tsx` logic (splitIntoColumns, getAssetPath, sentinel)
- Modify: `src/api/gallery/index.tsx` (JSON) + Hono asset headers already handle ETag/gzip/Range

- [ ] **Step 1: Port gallery**
Masonry grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5`, 5 columns `splitIntoColumns`, `columnVisibility` classes, `loading="lazy"` + `content-visibility:auto` on cards. Infinite scroll via IntersectionObserver sentinel (replaces `hx-trigger="revealed"`). Filter checkboxes for `image|video|all` updating query param.

- [ ] **Step 2: Client cache**
Simple `Map<string, GalleryItem[]>` keyed by `${type}:${cursor}`; dedup fetch.

- [ ] **Step 3: Verify caching/compression**
```bash
curl -I http://localhost:3000/assets/<existing-file> | grep -i "cache\|etag\|content-encoding"
curl -I "http://localhost:3000/api/gallery/items?limit=5" | grep -i cache
# check vite hashed assets exist
ls dist/client/assets/ 2>&1 | head
```

- [ ] **Step 4: Screenshot compare vs 04-gallery.png**

- [ ] **Step 5: Commit**
```bash
git add src/client/pages/Gallery.tsx src/client/components/GalleryCard.tsx
git commit -m "feat(client): Gallery with lazy/infinite + cache/compression"
```

### Task 7: Compose Page (SSE)

**Files:**
- Create: `src/client/pages/Compose.tsx`, `src/client/components/GenerationSettings.tsx`
- Port: `src/templates/compose.tsx`, `generation-settings-cards.tsx`

Keep: style_guide textarea, script textarea/upload, fps/clip_duration/etc., SSE for `compose-progress`. Forms POST to `POST /api/jobs/videos/compose`. Progress via SSE + polling.

Match `05-compose.png`.

Commit similarly.

### Task 8: Create Pages — Image, Video, Audio, AutoCut, Text

**Files:**
- Create: `src/client/pages/CreateImage.tsx`, `CreateVideo.tsx`, `CreateAudio.tsx`, `AutoCut.tsx`, `CreateText.tsx`, `src/client/components/DistinctMedia.tsx` etc.
- Port: `src/templates/distinct-image.tsx`, `distinct-audio.tsx`, `autocut.tsx`, plus `src/api/create/*` JSON forms

Each page: form → `POST /api/jobs/images` or `/api/jobs/audio` etc., SSE progress for that job. Match `06-autocut.png`, `07-image.png`, `08-audio.png`. Text page covers `src/templates` text; video covers `create/video`.

Commit per page or batched: `feat(client): Create pages (image/video/audio/autocut/text)`

### Task 9: Settings + Cleanup + Verification

**Files:**
- Create: `src/client/pages/Settings.tsx` (port `settings.tsx`)
- Delete: `src/templates/*`, `src/api/dashboard`, `compose` HTML, `fragments/*`, `create` HTML leftovers, `static/htmx*`, `static/alpine*`, `static/handlers.js`, `static/theme.js`, `typed-htmx` dep
- Modify: `package.json` (remove typed-htmx), `src/api/api.tsx` final SPA fallback polish

- [ ] **Step 1: Port Settings**

- [ ] **Step 2: Delete SSR artifacts**
```bash
rm -rf src/templates src/api/fragments
rm -f static/htmx.min.js static/htmx-ext-sse.min.js static/alpine.min.js static/handlers.js static/theme.js
bun remove typed-htmx 2>&1 | tail -20
```

- [ ] **Step 3: Verify full flow**
```bash
bunx tsc --noEmit 2>&1 | tail -20
bun run lint 2>&1 | tail -20
bunx vite build 2>&1 | tail -20
bun start:hot & sleep 4
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/dashboard | head # should now be SPA index.html fallback
# chrome screenshots for all pages again — compare to baseline
```

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "feat(client): Settings + remove HTMX SSR artifacts, final cleanup"
```

---

## Execution Notes

- Subagents: dispatch one per Task (1-9) in order, but Tasks 4-8 independent after Task 3 — can parallelize via dispatching-parallel-agents.
- TDD: for JSON endpoints, write fetch asserts (`curl` or small `fetch` test); for Solid components, verify DOM snapshot matches baseline where possible (playwright `expect(page).toHaveScreenshot()` or chrome-devtools snapshot diff).
- Review: after Task 9, run n parallel reviewers (one per baseline page) comparing post-refactor screenshots/DOM to baseline PNGs; block if mismatch.
- Do not merge until adversarial review PASS + lint/typecheck/build green.

