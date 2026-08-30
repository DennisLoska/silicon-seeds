# Spec: Publish-Ready Cleanup — GPL, remove autocut/whisperx/playwright/youtube, settings + loras DB

Date: 2026-08-30
Branch: cleanup/publish-ready
Status: approved

## 1. Problem & Goal

Project not publish-ready: UNLICENSED, contains autocut/whisperx/youtube/playwright dead weight, settings UI empty, style defaults hardcoded in `src/styles/*`, loras hardcoded to single `LoraLoaderModelOnly` node in comfyui workflows. Needs GPL-3.0, full removal of autocut stack, and DB-backed CRUD for styles + loras with draggable ordered loras (0.1-2.0 strength) dynamically injected as N+1 LoraLoader chain into existing `image_z_image_turbo_lora_720p.json` workflow, surfaced in Compose + CreateImage/CreateVideo via ComfyUI discovery.

## 2. Non-goals

- No new image/video models beyond lora chaining
- No auth / multi-user
- No change to queue/SSE/gallery/job infra except removal of autocut paths
- Keep existing jobs functional (failed autocut jobs stay in DB but UI hidden)

## 3. Scope

### 3.1 License → GPL-3.0
- Add `LICENSE` GPL-3.0 text, update `package.json.license` to `GPL-3.0-or-later`, update README header, ensure headers where needed.
- License choice: GPL-3.0-or-later (requires derivative to be open source, as requested). Alternative AGPL considered but rejected — GPL sufficient for distribution requirement, less restrictive on SaaS.

### 3.2 Remove autocut/whisperx/playwright/youtube — leave no trace
Must delete:
- `src/autocut/*`, `src/whisperx/*`, `src/api/api/autocut-video.ts`
- `autocut.*` prompt helpers in `src/prompts/prompt-generator.ts` (`autocut_chunk_prompt`, `autocut_plan_from_whisperx_json`, `autocut_insertions_from_whisperx_json`)
- DB: `autocut_cut_clips` table + indexes + references in `src/db/tables.ts` + `src/db/db.ts` (DbSchema, drop, delete, select)
- Routes: `/create/autocut`, `POST /api/jobs/videos/autocut` in `src/api/api/index.ts`, `src/socket/socket-server.ts` autocut handling, `src/client/pages/AutoCut.tsx`, `src/client/App.tsx` route, `src/client/components/Layout.tsx` nav entry, job workflow `"autocut"` handling
- Dependencies: check `package.json` for playwright, whisperx, yt-dlp references; config/env whisperx/yt-dlp; docs references; tests
- Verify via `rg -i "autocut|whisperx|playwright|yt-dlp|ytdl|youtube"` → 0 hits after

### 3.3 Settings defaults into DB + CRUD page

**Current:** settings page empty, defaults hardcoded via `Metadata.*`, `Styles.*`, `StylePresets.*`.

**Target tables:**
```
style_presets (
  id TEXT PK,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  primary_style TEXT NOT NULL,
  secondary_trigger TEXT,
  styles_json TEXT NOT NULL, -- JSON array of style prompt strings
  texture TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
loras (
  id TEXT PK,
  comfyui_name TEXT UNIQUE NOT NULL, -- e.g. "Zimage_pencil_sketch.safetensors"
  display_name TEXT NOT NULL,
  trigger_word TEXT,
  is_active BOOLEAN DEFAULT 1,
  sort_order INTEGER NOT NULL,
  created_at TEXT
) -- loras table stores catalog of loras available in DB (synced from ComfyUI)
settings (
  key TEXT PK,
  value TEXT NOT NULL -- JSON stringified
)
```
Alternatively `settings` holds defaults like `default_style_preset`, `default_fps`, `default_resolution` etc. For simplicity keep existing job columns defaults via settings table rather than new columns.

Initialize: on migrate, seed `style_presets` from `mflux-forge` Styles (WATERCOLOR ~70 variants, GENERAL, MIXED, NONE, TEXTURE list) — inspiration, curated to ~15-20 defaults. Seed `settings` with keys: `default_style_preset`, `default_fps` (16), `default_clip_duration` (5), `default_transition_duration` (2), `default_resolution` (720p), `default_image_model`, `default_video_model`.

**API:** `GET/POST /api/settings`, `GET/POST /api/style-presets`, `GET/PUT/DELETE /api/style-presets/:id`, `GET /api/loras`, `POST /api/loras/sync` (discover from ComfyUI), `POST/PUT/DELETE /api/loras` for CRUD, `PUT /api/loras/reorder`.

**UI Settings page:** sections: Defaults (fps/clip/transition/resolution/models/style dropdowns), Style Presets CRUD (list + create/edit/delete modal, styles textarea JSON or line-per-entry, texture picker), Loras catalog (sync button → list from ComfyUI `/object_info` or `/api/loras` proxy, add to DB, reorder drag, active toggle, delete).

### 3.4 Loras as first-class, ordered, strength-controlled
- ComfyUI discovery: `GET /api/comfyui/loras` proxies `GET {COMFYUI_BASE_URL}/object_info` filtering `LoraLoader`/`LoraLoaderModelOnly` or list via filesystem scan? Preferred: call `/api/object_info` to get available lora files? Actually ComfyUI exposes loras via `/api/loras` or `GET /object_info` contains no file list; real file list via `GET /object_info` not sufficient. Use `GET {COMFYUI_BASE_URL}/loras` or fallback to reading `models/loras` directory listing via custom endpoint — investigate via comfyui docs + chrome devtools: try `GET /api/loras`, `GET /loras`, `GET /object_info` + check. Implement `ComfyUIClient.listLoras(): Promise<string[]>` trying `/api/loras` then `/object_info` parsing.
- Compose + CreateImage (+ CreateVideo if applicable) views: add Lora selector section: dropdown of DB loras (is_active), Add button, ordered list draggable (use native drag or small lib, no heavy dependency), each row: name, trigger, strength slider 0.1-2.0 (step 0.1), remove button. Selected loras saved per-job via `POST` payload `loras: {name, strength}[]`.
- Backend: extend `events.lora` column from single string to JSON array? Keep backward compat: store JSON array in `events.lora` (currently `Lora | null`), migrate to allow `string` JSON. Or add `event_loras` join table. Simpler: reuse `events.lora` as JSON string `[{"name":"X.safetensors","strength":0.7}]`. Update `src/db/db.ts` type.
- Workflow injection: dynamically compose N+1 `LoraLoaderModelOnly` chain from base UNET loader.
  - Base workflow `image_z_image_turbo_lora_720p.json`: node 46 UNETLoader → 51 LoraLoaderModelOnly → 47 ModelSamplingAuraFlow. For N loras, chain: 46 → 51_0 → 51_1 → ... → 51_N-1 → 47. If N=0, bypass lora chain: 46 → 47 directly (use `image_z_image_turbo_720p.json` base). Implement `buildLoraChain(api, loras)` that clones nodes, rewires `model` input, preserves strengths.
  - Must adjust `buildApi` in `comfyui-client.ts` to handle `input.loras?: {name:string,strength:number}[]` instead of single `lora`.
  - Verify via `chrome-devtools` rendering preview + `curl` queue submission + comfyui direct test.

### 3.5 Cleanup general
- Remove dead code found by `rg` trace
- `bun tsc --noEmit`, `bun run lint` green
- `bun start:hot` + `curl` checks for jobs/image/compose
- Actual asset generation verify via ComfyUI base URL

## 4. Architecture

- DB migration `migrate.ts` adds new tables, seeds, drops autocut table (with safe recreation via `createTables` idempotent? Instead new migration file). Use Kysely schema builder.
- API routes: new `src/api/settings.ts`, `src/api/style-presets.ts`, `src/api/loras.ts`, `src/api/comfyui.ts` (proxy).
- Client: `src/client/pages/Settings.tsx` full CRUD, `src/client/components/LoraSelector.tsx` reusable, used in Compose/CreateImage/CreateVideo.
- ComfyUI client: add `listLoras()` + `buildLoraChain` helper.

## 5. Data Flow

Settings page → `GET /api/settings` → `settings` table → defaults injected into Compose/Image forms as initial values.
Loras page → Sync → `GET /api/comfyui/loras` → ComfyUI → POST to `/api/loras` → DB → selector dropdowns read `GET /api/loras`.

Image generation: form submits `loras: [{name,strength}]` + other params → `text-to-image.ts` creates job + events with lora JSON → queue → `comfyui-client.buildApi` → chain → ComfyUI `/prompt`.

## 6. Error Handling

- ComfyUI unavailable: loras sync returns 502 with message, UI shows error, existing DB loras still usable.
- N=0 loras: no chain, use base workflow.
- Strength out of range: clamp 0.1-2.0 server-side, validate with zod.
- Deleting style preset in use: allow, show warning, fallback to system default.
- Migration idempotent: IF NOT EXISTS checks.

## 7. Testing

- `bun tsc --noEmit` passes
- `curl http://localhost:3000/api/settings` returns defaults
- `curl http://localhost:3000/api/loras` CRUD cycle
- Create image with 0,1,3 loras → ComfyUI history shows correct chain length
- Drag reorder persists via `PUT /api/loras/reorder`
- No `rg autocut|whisperx|playwright|youtube` hits

## 8. Risks

- ComfyUI lora discovery endpoint varies by version → implement 2-3 fallbacks.
- Draggable without lib may have a11y issues → keep simple HTML5 drag, add up/down fallback buttons.
- Removing autocut may break old jobs referencing autocut table → keep drop safe with IF EXISTS.

## 9. Alternatives Considered

- Single style string vs DB: rejected, user wants CRUD.
- Separate `event_loras` table vs JSON in `events.lora`: JSON simpler, preserves existing queue logic, no join overhead. Chose JSON array stringified.
- Using `mflux-forge` styles verbatim vs curated subset: import curated 15 presets to avoid 70-entry bloat, user can CRUD add more.

## 10. Acceptance Criteria

- LICENSE GPL-3.0, package.json, README updated
- `rg -i "autocut|whisperx|playwright|yt-dlp|youtube"` 0 hits (except maybe README changelog)
- Settings page functional CRUD + defaults persist
- Loras DB table exists, sync from ComfyUI works, draggable ordered list with strength 0.1-2.0 in Compose+Image, N+1 chain verified via actual generation
- Build green, no regressions
