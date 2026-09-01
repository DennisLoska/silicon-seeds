# Spec: Cleanup .env.example + DB relocation + Playwright E2E

Date: 2026-09-01

## Purpose
Harden 12-factor config, remove stale auth scaffolding, relocate SQLite DB to `data/` with proper gitignore/history cleanup, and add headless Playwright E2E coverage for 7 UI pages without triggering media generation.

## Context
- Current `.env.example` leaks personal paths (`/home/dennis/...`), lacks `BETTER_AUTH_SECRET` drift, contains no `YT_DLP` usage in src but still in `.env`.
- `src/main.ts:63` TODO better-auth never implemented, no `BETTER_AUTH` usage found. `YT_DLP` only referenced in `.env`, zero code refs.
- DB path hardcoded `src/db/db.ts:111` as `silicon-seeds.sqlite` at repo root, ignored but risky. `data.db` 0-byte tracked file should be removed. History contains `data.db`.
- No E2E tests exist. 7 pages in `src/client/pages`: Jobs, Gallery, Compose, CreateImage, CreateAudio, CreateVideo, Settings. App shell `src/client/App.tsx` routes `/jobs`, `/jobs/:jobId`, `/gallery`, `/compose`, `/create/image`, `/create/audio`, `/create/video`, `/settings`.
- Stack: Bun, Hono `src/api/api.tsx`, SolidJS, Vite, DaisyUI. Tests must run headless, TS strict, not press generate/upload.

## Goals
- Clean `.env.example`, remove dead config, align with 12-factor (env-driven, no secrets in example, placeholder paths).
- Move DB to `data/silicon-seeds.sqlite`, create `data/.gitkeep` ignored dir, update code + gitignore, purge tracked `data.db` from index and history-safe (filter-branch not needed for 0-byte, just `git rm --cached`).
- Playwright TS E2E: >=7 tests, one per page happy path, no generation/upload, headless, CI-ready.

## Non-goals
- Implementing auth. Just removing dead BETTER_AUTH stub.
- Media generation or upload testing.
- Video rendering pipeline changes.

## Approach Options
1) **Minimal cleanup + Playwright**: Edit `.env.example`, move DB file literal, add playwright config. Pros: fast. Cons: misses env var validation polish.
2) **12-factor strict (chosen)**: `.env.example` becomes canonical template with `VAR=placeholder` docs, code uses `Bun.env` with validation/fallbacks, DB path env-driven with default `data/silicon-seeds.sqlite`. Pros: future-proof, ThePrimeAgen style, vim-friendly. Cons: slightly more code.
3) **Full refactor**: Extract config module `src/config.ts` with Zod validation. Pros: best practice. Cons: overkill for current scope, breaks existing `Bun.env.*` pattern.

Recommendation: Option 2, lightweight 12-factor without full Zod extract - keep `Bun.env` reads but centralize DB path + validate in `db.ts`.

## Design

### 1. .env.example cleanup
- Remove `BETTER_AUTH_SECRET` line (not present, ensure not re-added), remove `YT_DLP` entirely.
- Replace absolute personal paths with placeholders:
  ```
  COMFYUI_BASE_URL=http://127.0.0.1:8188
  COMFYUI_BASE_WS=ws://127.0.0.1:8188
  OUTPUT_DIR=/path/to/comfy-ui/output
  INPUT_DIR=/path/to/comfy-ui/input
  CONTENT_LIBRARY_DIR=/path/to/content_library
  LOG_LEVEL=info
  NODE_ENV=development
  LLM_MODEL=qwen3.6-35b-a3b
  CHROMADB_HOST=127.0.0.1
  CHROMADB_PORT=8000
  EMBEDDING_MODEL=text-embedding-qwen3-embedding-8b
  VOICEBOX_URL=http://127.0.0.1:17493
  ```
- Also clean `.env` (real file) - remove `BETTER_AUTH_SECRET` and `YT_DLP` lines, keep personal paths there (real local config). Document in README if needed.

### 2. DB relocation
- New path: `data/silicon-seeds.sqlite`
- Code: `src/db/db.ts:111` `new Database("silicon-seeds.sqlite")` -> `new Database(Bun.env.DB_PATH ?? "data/silicon-seeds.sqlite")` or hardcoded `data/...` with `Bun.env.DB_PATH` override for 12-factor. Ensure directory `data/` exists via `mkdir -p` in `DB.init` or at startup.
- Migration script: `mv silicon-seeds.sqlite data/silicon-seeds.sqlite` if exists, else fresh DB in new location.
- `.gitignore`: add `data/` (already has `data.db`? check) - ensure `data/*.sqlite` ignored but `!data/.gitkeep` kept. Remove old `silicon-seeds.sqlite` line or keep for backward compat then remove. Add `data/` blanket or `data/*.db` `data/*.sqlite`.
- Git history: `git rm --cached data.db` (0-byte, no sensitive data, simple index removal suffices). For full history purge, `git filter-branch`/`filter-repo` would rewrite history and break remote - out of scope unless requested. Document `data.db` removed from index, history retains empty blob (harmless).
- Verify no other hardcodes: grep `silicon-seeds.sqlite` only in `db.ts:111` and `.gitignore:145`.

### 3. Playwright E2E
- Install: `bun add -d @playwright/test` + `bunx playwright install --with-deps chromium` (headless only, no firefox/webkit to keep CI light).
- Config: `playwright.config.ts` at root, TS, `testDir: "e2e"`, `baseURL: "http://localhost:3000"`, `webServer: { command: "bun run build && bun start", url: "http://localhost:3000", reuseExistingServer: !process.env.CI }` or dev server `bun --hot src/main.ts`? Need build first for Solid. Use `use: { baseURL, trace: "on-first-retry" }`, `fullyParallel: true`, `retries: 0`.
- 12-factor: baseURL via `PLAYWRIGHT_BASE_URL` env fallback.
- Structure: `e2e/` dir, one spec per page (or `e2e/happy-paths.spec.ts` with describe per page). At least 7 tests, no `generate` presses.
- Pages & happy paths (no generate/upload):
  - Jobs list `/jobs` - loads, shows heading/filter, navigates
  - Job detail `/jobs/:jobId` - with seeded DB or via list click, shows status/events tabs
  - Gallery `/gallery` - loads, shows grid or empty state
  - Compose `/compose` - loads form, can type prompt/style without submit
  - CreateImage `/create/image` - loads, form fields visible, interact without generating
  - CreateAudio `/create/audio` - loads, audio controls visible
  - CreateVideo `/create/video` - loads, video options visible
  - Settings `/settings` - loads, toggles visible
- Each test: `await page.goto("/route")`, `await expect(page.getByRole(...)).toBeVisible()`, interact with inputs (fill, select) but assert `not.toHavePressedGenerate`.
- Isolation: Tests start with fresh DB seed or empty DB; no media generation means no ComfyUI needed. Mock/minimal DB via existing `silicon-seeds.sqlite` moved.
- NPM scripts: `"test:e2e": "playwright test"`, `"test:e2e:headed": "playwright test --headed"` for debug.
- CI: headless default, `--reporter=list`.
- Vim/Primeagen: TS strict, no fluff, `expect` precise, use `page.getByRole` locators (best practice), no `waitForTimeout`.

### 4. File layout
```
data/.gitkeep
e2e/
  jobs.spec.ts
  gallery.spec.ts
  compose.spec.ts
  create-image.spec.ts
  create-audio.spec.ts
  create-video.spec.ts
  settings.spec.ts
  helpers.ts (optional goto helpers)
playwright.config.ts
```

### 5. Risks
- Moving DB breaks existing devs with old path - handle fallback check both locations then migrate.
- Playwright webServer must wait for `Bun.serve` port 3000; use `wait` timeout 60s.
- Tests flaky if Solid suspense fallback lingers - use `expect(...).toBeVisible({timeout:10000})`.

## Success criteria
- `git status` clean except `data/` ignored
- `.env.example` has no BETTER_AUTH, no YT_DLP, placeholder paths
- `src/db/db.ts` points to `data/silicon-seeds.sqlite`
- `git ls-files | grep -E "data.db|silicon"` empty for tracked DB
- `bunx playwright test --list` shows >=7 tests
- `bunx playwright test` headless passes (7/7 green), no generate pressed
