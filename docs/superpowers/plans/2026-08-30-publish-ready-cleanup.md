# Publish-Ready Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GPL-3.0 license, remove autocut/whisperx/playwright/youtube traces, DB-backed settings + style presets CRUD + loras first-class with draggable ordered strengths and N+1 LoraLoader chain.

**Architecture:** New Kysely tables `settings`, `style_presets`, `loras`; seed from mflux-forge styles; new Hono JSON routes under `/api/settings`, `/api/style-presets`, `/api/loras`, `/api/comfyui/loras`; `ComfyUIClient.buildApi` refactored to chain N LoraLoaderModelOnly nodes; SolidJS `Settings.tsx` CRUD + `LoraSelector.tsx` draggable used in Compose/CreateImage/CreateVideo.

**Tech Stack:** Bun, Hono, Kysely + bun:sqlite, SolidJS + DaisyUI, ComfyUI API, Tailwind

---

### Task 1: License to GPL-3.0

**Files:**
- Create: `LICENSE`
- Modify: `package.json:10-15`, `README.md:1-10`

- [ ] Step 1: Write LICENSE GPL-3.0 text (fetch from gnu.org or use standard header). Use `curl -s https://www.gnu.org/licenses/gpl-3.0.txt` content.

- [ ] Step 2: Edit package.json license field

```json
"license": "GPL-3.0-or-later"
```

- [ ] Step 3: Add README badge/header note "Licensed under GPL-3.0-or-later"

- [ ] Step 4: Run `bunx tsc --noEmit` ensure still passes

- [ ] Step 5: Commit

```bash
git add LICENSE package.json README.md
git commit -m "chore: license to GPL-3.0-or-later"
```

---

### Task 2: Remove autocut/whisperx/playwright/youtube — leave no trace

**Files:**
- Delete: `src/autocut/autocut-workflow.ts`, `src/whisperx/whisperx.ts`, `src/api/api/autocut-video.ts`, `src/client/pages/AutoCut.tsx`
- Modify: `src/prompts/prompt-generator.ts`, `src/api/api/index.ts`, `src/socket/socket-server.ts`, `src/db/tables.ts`, `src/db/db.ts`, `src/client/App.tsx`, `src/client/components/Layout.tsx`, `src/comfyui/comfyui-client.ts` (autocut import), `package.json` (if playwright dep), docs

- [ ] Step 1: Verify hits before deletion

```bash
rg -i "autocut|whisperx|playwright|yt-dlp|ytdl|youtube" --glob '!*.lock' --glob '!docs/superpowers/specs/*' | head -n 50
```

- [ ] Step 2: Delete files

```bash
rm -rf src/autocut src/whisperx src/api/api/autocut-video.ts src/client/pages/AutoCut.tsx
```

- [ ] Step 3: Edit src/prompts/prompt-generator.ts — remove autocut_chunk_prompt, autocut_plan_from_whisperx_json, autocut_insertions_from_whisperx_json and their imports

- [ ] Step 4: Edit src/api/api/index.ts — remove autocut_video import and route "/jobs/videos/autocut"

- [ ] Step 5: Edit src/socket/socket-server.ts — remove AutoCutWorkflow import and workflow=="autocut" branch

- [ ] Step 6: Edit src/db/tables.ts — remove dropTable/createTable/createIndex for autocut_cut_clips

- [ ] Step 7: Edit src/db/db.ts — remove autocut_cut_clips from DbSchema, delete/insert/select branches for autocut

- [ ] Step 8: Edit src/client/App.tsx — remove AutoCut lazy import and Route "/create/autocut"

- [ ] Step 9: Edit src/client/components/Layout.tsx — remove AutoCut nav entry and getPageTitle case

- [ ] Step 10: Verify 0 hits

```bash
rg -i "autocut|whisperx|playwright|yt-dlp|youtube" --glob '!LICENSE' --glob '!bun.lock' | wc -l
# expect 0
```

- [ ] Step 11: `bunx tsc --noEmit`

- [ ] Step 12: Commit

```bash
git add -A
git commit -m "chore: remove autocut/whisperx/playwright/youtube"
```

---

### Task 3: DB migration — settings/style_presets/loras + seed + drop autocut

**Files:**
- Modify: `src/db/tables.ts`, `src/db/db.ts`, `src/db/migrate.ts`
- Create: `src/db/seed.ts` (optional)

- [ ] Step 1: Add tables in src/db/tables.ts after meta table:

```ts
await db.schema.createTable("settings").ifNotExists()
  .addColumn("key","text",c=>c.primaryKey().notNull())
  .addColumn("value","text",c=>c.notNull())
  .execute();
await db.schema.createTable("style_presets").ifNotExists()
  .addColumn("id","text",c=>c.primaryKey().notNull())
  .addColumn("name","text",c=>c.notNull().unique())
  .addColumn("description","text")
  .addColumn("primary_style","text",c=>c.notNull())
  .addColumn("secondary_trigger","text")
  .addColumn("styles_json","text",c=>c.notNull())
  .addColumn("texture","text")
  .addColumn("created_at","text",c=>c.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
  .execute();
await db.schema.createTable("loras").ifNotExists()
  .addColumn("id","text",c=>c.primaryKey().notNull())
  .addColumn("comfyui_name","text",c=>c.notNull().unique())
  .addColumn("display_name","text",c=>c.notNull())
  .addColumn("trigger_word","text")
  .addColumn("is_active","integer",c=>c.notNull().defaultTo(1))
  .addColumn("sort_order","integer",c=>c.notNull())
  .addColumn("created_at","text",c=>c.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
  .execute();
```

Also keep dropping autocut_cut_clips if exists (idempotent).

- [ ] Step 2: Extend DbSchema in src/db/db.ts with settings/style_presets/loras interfaces

```ts
settings: { key: string; value: string }
style_presets: { id: string; name: string; description: string|null; primary_style: string; secondary_trigger: string|null; styles_json: string; texture: string|null; created_at: string }
loras: { id: string; comfyui_name: string; display_name: string; trigger_word: string|null; is_active: number; sort_order: number; created_at: string }
```

Change events.lora type to `string | null` (JSON array string) and keep backward compat.

- [ ] Step 3: Seed defaults in migrate.ts or tables.ts after creation: insert 12-15 style presets (system, watercolor, pencil_watercolor plus curated mflux-forge inspired like anime, ghibli, pixel_art, oil_paint, charcoal, cyberpunk, vintage, cinematic etc). Use Utils.randomId or crypto. Insert settings keys: default_style_preset=system, default_fps=16, default_clip_duration=5, default_transition_duration=2, default_resolution=720p, default_image_model=z-image-turbo, default_video_model=wan2.2.

- [ ] Step 4: Run migration locally

```bash
bun src/db/migrate.ts
echo $?
bunx tsc --noEmit
```

- [ ] Step 5: Commit

```bash
git add src/db/*
git commit -m "feat(db): settings/style_presets/loras tables + seed"
```

---

### Task 4: API endpoints — settings/style-presets/loras/comfyui

**Files:**
- Create: `src/api/settings.ts`, `src/api/style-presets.ts`, `src/api/loras.ts`, `src/api/comfyui.ts`
- Modify: `src/api/api/index.ts`, `src/api/schemas.ts` (zod), `src/main.ts` (route mount if needed)

- [ ] Step 1: Create src/api/settings.ts

```ts
// GET /api/settings, PUT /api/settings {key,value} or {settings: Record}
import { Hono } from "hono"
import { db } from "../db/db"
```

Implement get all, get by key, put.

- [ ] Step 2: Create src/api/style-presets.ts — CRUD with zod validation for name/styles_json (array), texture optional.

- [ ] Step 3: Create src/api/loras.ts — GET list ordered by sort_order, POST create, PUT/:id update, DELETE/:id, PUT /reorder {ids:string[]}, POST /sync {names:string[]} bulk upsert from comfyui discovery.

- [ ] Step 4: Create src/api/comfyui.ts — GET /api/comfyui/loras proxies to ComfyUIClient.listLoras() with fallback.

- [ ] Step 5: Register in src/api/api/index.ts (or src/main.ts) — mount hono sub-routers.

- [ ] Step 6: Test via curl

```bash
curl -s http://localhost:3000/api/settings | head
curl -s http://localhost:3000/api/style-presets | head
curl -s http://localhost:3000/api/loras | head
```

- [ ] Step 7: `bunx tsc --noEmit`

- [ ] Step 8: Commit

```bash
git add src/api/*
git commit -m "feat(api): settings/style-presets/loras/comfyui endpoints"
```

---

### Task 5: ComfyUI client — N+1 lora chain + listLoras

**Files:**
- Modify: `src/comfyui/comfyui-client.ts`, `src/comfyui/api/image_z_image_turbo_lora_720p.json` (reference)
- Test via direct ComfyUI call

- [ ] Step 1: Add type

```ts
type LoraSpec = { name: string; strength: number } // name includes .safetensors
type Text2ImgInput = { id:string; kind:"text-to-image"; prompt:string; loras?: LoraSpec[] }
```

- [ ] Step 2: Implement listLoras(): try `${base}/api/loras`, then `${base}/loras`, then fallback parse `/object_info` for LoraLoader nodes? Actually list files via `/api/loras` is typical. If all fail return [] and log.

- [ ] Step 3: Implement buildLoraChain:

```ts
function buildLoraChain(baseApi: Record<string,any>, loras: LoraSpec[]): Record<string,any> {
  if (!loras.length) return baseApi // caller will use non-lora base
  // clone, start from UNETLoader node 46
  // chain 51, 51_1, etc chaining model input
}
```

Details: if loras empty use zImageTurboApi (no lora). If 1..N use WithLoraApi as template: keep node 51 for first, create 52,53 etc for additional with class_type LoraLoaderModelOnly, wiring: 46→51→51_1→...→47. Adjust ModelSamplingAuraFlow node 47 model input to last lora.

- [ ] Step 4: Update buildApi text-to-image branch to use new chain, set each strength.

- [ ] Step 5: Test with curl + comfyui direct if available

```bash
bunx tsc --noEmit
# manual: submit image job with loras via API
curl -X POST http://localhost:3000/api/jobs/images -F "prompt=test" -F 'loras=[{"name":"Zimage_pencil_sketch.safetensors","strength":0.7}]'
```

- [ ] Step 6: Commit

```bash
git add src/comfyui/*
git commit -m "feat(comfyui): N+1 lora chain + listLoras"
```

---

### Task 6: Settings page CRUD UI

**Files:**
- Modify: `src/client/pages/` — Create `src/client/pages/Settings.tsx`
- Modify: `src/client/App.tsx` (route), `src/client/components/Layout.tsx` (nav)
- Modify: `src/client/lib/api-client.ts` if needed

- [ ] Step 1: Build Settings.tsx with sections:
 - Defaults form (fps, clip_duration, transition_duration, resolution, image_model, video_model, default_style_preset dropdown) → PUT /api/settings
 - Style Presets table with CRUD modal (name, description, primary_style, secondary_trigger, texture picker from Styles.TEXTURE, styles textarea one per line → JSON array) → /api/style-presets
 - Loras catalog (sync button → GET /api/comfyui/loras → show discovered → add to DB; active toggle, delete, drag reorder + up/down fallback)

- [ ] Step 2: Register route /settings in App.tsx, add nav entry.

- [ ] Step 3: Verify via chrome-devtools or curl that page loads.

- [ ] Step 4: `bunx tsc --noEmit`

- [ ] Step 5: Commit

```bash
git add src/client/*
git commit -m "feat(ui): settings CRUD page"
```

---

### Task 7: LoraSelector component + Compose/Image/Video integration

**Files:**
- Create: `src/client/components/LoraSelector.tsx`
- Modify: `src/client/pages/Compose.tsx`, `src/client/pages/CreateImage.tsx`, `src/client/pages/CreateVideo.tsx`, `src/api/api/compose-video.ts`, `src/api/api/text-to-image.ts`, `src/api/api/text-to-image-to-video.ts` etc

- [ ] Step 1: Create LoraSelector.tsx:

```tsx
type LoraItem = { name:string; strength:number }
props: { value:LoraItem[]; onChange:(v:LoraItem[])=>void }
// fetches GET /api/loras, dropdown to add, sortable list with drag + slider 0.1-2.0 step 0.1, remove
```

Use HTML5 drag: draggable, onDragStart/Over/Drop reorder. Slider input range.

- [ ] Step 2: Integrate into CreateImage.tsx — add state createSignal<LoraItem[]>, render <LoraSelector />, onSubmit include FormData loras JSON.

- [ ] Step 3: Same for Compose.tsx and CreateVideo.tsx (if video supports loras, otherwise just image part — still wire compose which has image_model).

- [ ] Step 4: Update backend API handlers to parse loras from formData/json: zod `loras: z.array(z.object({name:z.string(),strength:z.number().min(0.1).max(2)}))` optional.

- [ ] Step 5: Store in events.lora as JSON string in JobOrchestrator/create.

- [ ] Step 6: Verify via curl submit with loras, check DB events.lora JSON.

- [ ] Step 7: `bunx tsc --noEmit`

- [ ] Step 8: Commit

```bash
git add src/client/* src/api/*
git commit -m "feat(ui+api): lora selector draggable + backend"
```

---

### Task 8: Verification + cleanup

- [ ] Step 1: `rg -i "autocut|whisperx|playwright|yt-dlp|youtube"` → 0

- [ ] Step 2: `bunx tsc --noEmit` + `bun run lint` green

- [ ] Step 3: `bun start:hot` curl checks:

```bash
curl -s http://localhost:3000/api/settings | jq .
curl -s http://localhost:3000/api/loras | jq .
curl -s http://localhost:3000/api/style-presets | jq .
```

- [ ] Step 4: Chrome devtools navigate to /settings, /create/image, /compose verify lora selector and settings CRUD

- [ ] Step 5: Actual generation test if COMFYUI_BASE_URL reachable:

```bash
curl -X POST http://localhost:3000/api/jobs/images -F "prompt=a watercolor cat" -F "batch_size=1" -F "resolution=720p" -F 'loras=[{"name":"Zimage_pencil_sketch.safetensors","strength":0.7}]'
# check jobs events + comfyui history
```

- [ ] Step 6: Remove docs ignored? Ensure .gitignore allows docs/superpowers via -f earlier committed.

- [ ] Step 7: Final commit if fixes needed

```

