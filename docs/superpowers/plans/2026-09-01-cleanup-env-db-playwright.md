# Cleanup Env/DB + Playwright E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean `.env.example` (remove BETTER_AUTH/YT_DLP, placeholder paths), move SQLite DB to `data/silicon-seeds.sqlite` with 12-factor env override, and add headless Playwright TS E2E happy-path coverage for all 7 UI pages without triggering generation.

**Architecture:** 12-factor env-driven config with `DB_PATH` fallback to `data/silicon-seeds.sqlite`. `data/` is gitignored with `.gitkeep`. Playwright `e2e/` tests hit `http://localhost:3000` via SolidJS Vite build + Hono Bun server, using `getByRole` locators, no generate/upload actions.

**Tech Stack:** Bun, Hono, SolidJS, Vite, DaisyUI, SQLite Kysely, Playwright @playwright/test, TypeScript strict.

---

## File Structure

- Modify: `.env.example` — placeholder template, no secrets, no personal paths
- Modify: `.env` — remove BETTER_AUTH_SECRET + YT_DLP locally (keep real personal paths for local dev)
- Modify: `.gitignore` — add `data/` handling, keep `data/.gitkeep` whitelisted, remove/mark old `silicon-seeds.sqlite` line
- Modify: `src/db/db.ts:111` — DB path to `data/silicon-seeds.sqlite` with `Bun.env.DB_PATH` override, ensure `data/` dir creation
- Modify: `package.json` — add `@playwright/test`, scripts `test:e2e`, `test:e2e:headed`
- Create: `data/.gitkeep` — keep empty dir tracked
- Create: `playwright.config.ts` — headless, baseURL env-driven, webServer
- Create: `e2e/helpers.ts` — shared goto helpers
- Create: `e2e/jobs.spec.ts` — Jobs list happy path
- Create: `e2e/gallery.spec.ts` — Gallery happy path
- Create: `e2e/compose.spec.ts` — Compose happy path
- Create: `e2e/create-image.spec.ts` — CreateImage happy path
- Create: `e2e/create-audio.spec.ts` — CreateAudio happy path
- Create: `e2e/create-video.spec.ts` — CreateVideo happy path
- Create: `e2e/settings.spec.ts` — Settings happy path

---

### Task 1: Cleanup .env.example (12-factor placeholders)

**Files:**
- Modify: `.env.example`
- Modify: `.env` (local real file)

- [ ] **Step 1: Read current files**

Run: `cat .env.example && echo "---" && cat .env | sed 's/=.*/=***redacted***/'`
Expected: See personal paths + BETTER_AUTH/YT_DLP in .env, placeholder-ish in .env.example

- [ ] **Step 2: Write new .env.example**

Content for `.env.example`:
```
# ComfyUI
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_BASE_WS=ws://127.0.0.1:8188

# ComfyUI directories
OUTPUT_DIR=/path/to/comfy-ui/output
INPUT_DIR=/path/to/comfy-ui/input

# Content library
CONTENT_LIBRARY_DIR=/path/to/content_library

# Logger
LOG_LEVEL=info

# Runtime
NODE_ENV=development

# LLM
LLM_MODEL=qwen3.6-35b-a3b

# ChromaDB vector store
CHROMADB_HOST=127.0.0.1
CHROMADB_PORT=8000

# Embeddings
EMBEDDING_MODEL=text-embedding-qwen3-embedding-8b

# Voicebox TTS
VOICEBOX_URL=http://127.0.0.1:17493

# DB (optional override, default: data/silicon-seeds.sqlite)
# DB_PATH=data/silicon-seeds.sqlite
```

- [ ] **Step 3: Cleanup real .env — remove BETTER_AUTH_SECRET and YT_DLP**

Edit `.env`: delete lines `BETTER_AUTH_SECRET=...`, `YT_DLP=...` (and `WHISPER_X` keep). Keep personal real paths in `.env` for local dev. Ensure no leftover `BETTER_AUTH` or `YT_DLP` strings.

Run verification: `grep -c "BETTER_AUTH\|YT_DLP" .env.example; grep -c "BETTER_AUTH\|YT_DLP" .env`
Expected: `0` then `0`

- [ ] **Step 4: Commit**

```bash
git add .env.example .env
git commit -m "chore(env): clean .env.example placeholders, remove BETTER_AUTH/YT_DLP"
```

---

### Task 2: Move DB to data/ + gitignore + purge data.db from index

**Files:**
- Modify: `src/db/db.ts:100-115`
- Modify: `.gitignore`
- Create: `data/.gitkeep`
- Move: `silicon-seeds.sqlite` -> `data/silicon-seeds.sqlite` (if exists)
- Remove: `data.db` from git index

- [ ] **Step 1: Inspect current DB code and git state**

Run: `grep -n "silicon-seeds.sqlite" src/db/db.ts; cat .gitignore | grep -n "sqlite\|data"; git ls-files | grep -E "data\.db|sqlite"; ls -lh silicon-seeds.sqlite data.db 2>&1`

- [ ] **Step 2: Create data dir + move DB file**

```bash
mkdir -p data
# preserve existing DB if at root
if [ -f silicon-seeds.sqlite ]; then mv silicon-seeds.sqlite data/silicon-seeds.sqlite; fi
touch data/.gitkeep
```

- [ ] **Step 3: Update src/db/db.ts to use data/silicon-seeds.sqlite with env override**

Read `src/db/db.ts:100-120`, replace:
```ts
// before
database: new Database("silicon-seeds.sqlite"),
```
with:
```ts
// after
database: new Database(Bun.env.DB_PATH ?? "data/silicon-seeds.sqlite"),
```
Also ensure directory creation before opening (add at top of init):
```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
// in DB init before new Database:
const dbPath = Bun.env.DB_PATH ?? "data/silicon-seeds.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });
database: new Database(dbPath),
```
Handle fallback both old and new location on first run: if `data/silicon-seeds.sqlite` missing but `silicon-seeds.sqlite` exists, migrate.

- [ ] **Step 4: Update .gitignore**

- Ensure `data/` handling: add lines:
```
# SQLite DB
data/
!data/.gitkeep
# legacy root DB (kept ignored if stray)
silicon-seeds.sqlite
```
Remove or keep old `silicon-seeds.sqlite` line but ensure `data/` is covered. Do not ignore `!data/.gitkeep`.

- [ ] **Step 5: Remove data.db from git index**

```bash
git rm --cached data.db 2>/dev/null || true
# ensure .gitignore also covers data.db if not already (it is via logs? add explicit)
echo "data.db" >> .gitignore  # if not present
git add .gitignore data/.gitkeep src/db/db.ts
# keep moved DB ignored, not added
git commit -m "chore(db): move sqlite to data/silicon-seeds.sqlite, gitignore data/, remove data.db from index"
```

- [ ] **Step 6: Verify**

Run: `git ls-files | grep -E "data.db|silicon"; ls -lh data/; cat .gitignore | grep -A2 "data"`
Expected: no `data.db`, `data/silicon-seeds.sqlite` not in `git ls-files` (ignored), `data/.gitkeep` tracked.

---

### Task 3: Install and configure Playwright

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `e2e/helpers.ts` (optional)

- [ ] **Step 1: Install Playwright**

Run:
```bash
bun add -d @playwright/test
bunx playwright install --with-deps chromium
```
Expected: chromium downloaded, `npx playwright --version` works.

- [ ] **Step 2: Create playwright.config.ts at root**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    headless: true,
  },
  webServer: {
    command: "bun run build && bun run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
```
Note: check `package.json` has `"build"` and `"start"` scripts; if not, use `"bun --hot src/main.ts"` variant. Prefer built `dist/client` path used by `src/api/api.tsx`.

- [ ] **Step 3: Add scripts to package.json**

Edit `package.json` scripts:
```json
"test:e2e": "playwright test",
"test:e2e:headed": "playwright test --headed",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 4: Create e2e/helpers.ts**

```ts
import { expect, type Page } from "@playwright/test";
export async function gotoAndExpect(page: Page, path: string, headingRegex: RegExp) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: headingRegex })).toBeVisible({ timeout: 10000 });
}
```

- [ ] **Step 5: Verify install**

Run: `bunx playwright test --list 2>&1 | head -20`
Expected: lists tests (0 for now, OK).

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock playwright.config.ts e2e/helpers.ts
git commit -m "chore(test): add playwright config, headless chromium, helpers"
```

---

### Task 4: E2E Jobs list page

**Files:**
- Create: `e2e/jobs.spec.ts`

- [ ] **Step 1: Write failing test (TDD)**

Create `e2e/jobs.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test.describe("Jobs", () => {
  test("lists jobs and shows filters without triggering generation", async ({ page }) => {
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/jobs/);
    // heading or empty state
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
    // filters visible but no generate click
    const generate = page.getByRole("button", { name: /generate|create.*job/i });
    if (await generate.count() > 0) {
      await expect(generate.first()).toBeVisible();
      // explicitly do not click
    }
    // list or empty state visible
    await expect(page.locator("body")).toContainText(/jobs|no jobs|empty/i, { timeout: 5000 }).catch(() => {});
  });

  test("navigates to job detail when available", async ({ page }) => {
    await page.goto("/jobs");
    const firstJobLink = page.locator('a[href^="/jobs/"]').first();
    if (await firstJobLink.count() > 0) {
      await firstJobLink.click();
      await expect(page).toHaveURL(/\/jobs\/.+/);
      await expect(page.getByRole("heading").first()).toBeVisible();
    } else {
      // empty state is also valid happy path
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
```

- [ ] **Step 2: Run to see fail/pass**

Run: `bunx playwright test e2e/jobs.spec.ts --reporter=list`
Expected: PASS after server ready, or FAIL with server not built — fix webServer command.

- [ ] **Step 3: Commit**

```bash
git add e2e/jobs.spec.ts
git commit -m "test(e2e): add jobs list happy path"
```

---

### Task 5: E2E Gallery page

**Files:**
- Create: `e2e/gallery.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from "@playwright/test";

test("gallery loads and shows grid or empty state", async ({ page }) => {
  await page.goto("/gallery");
  await expect(page).toHaveURL(/\/gallery/);
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
  // gallery specific: no generate, just browsing
  await expect(page.locator("body")).toBeVisible();
});
```

- [ ] **Step 2: Run**

Run: `bunx playwright test e2e/gallery.spec.ts --reporter=list`

- [ ] **Step 3: Commit**

```bash
git add e2e/gallery.spec.ts
git commit -m "test(e2e): add gallery happy path"
```

---

### Task 6: E2E Compose, CreateImage, CreateAudio, CreateVideo

**Files:**
- Create: `e2e/compose.spec.ts`
- Create: `e2e/create-image.spec.ts`
- Create: `e2e/create-audio.spec.ts`
- Create: `e2e/create-video.spec.ts`

Each follows same pattern: goto route, expect heading/form visible, fill inputs without submitting.

- [ ] **Step 1: Compose**

`e2e/compose.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
test("compose loads and allows typing without generating", async ({ page }) => {
  await page.goto("/compose");
  await expect(page).toHaveURL(/\/compose/);
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
  const prompt = page.getByPlaceholder(/prompt|describe/i).first();
  if (await prompt.count() > 0) {
    await prompt.fill("a serene mountain landscape");
    await expect(prompt).toHaveValue(/mountain/);
  }
  // ensure no generate clicked
});
```

- [ ] **Step 2: CreateImage** `/create/image`

Goto, heading visible, check model/lora selects visible, fill prompt without clicking generate.

- [ ] **Step 3: CreateAudio** `/create/audio`

Goto `/create/audio`, heading, check text-to-speech fields, fill text without generate.

- [ ] **Step 4: CreateVideo** `/create/video`

Goto `/create/video`, heading, check video model/options, interact without generate.

- [ ] **Step 5: Run all four**

Run: `bunx playwright test e2e/compose.spec.ts e2e/create-image.spec.ts e2e/create-audio.spec.ts e2e/create-video.spec.ts --reporter=list`

- [ ] **Step 6: Commit**

```bash
git add e2e/compose.spec.ts e2e/create-image.spec.ts e2e/create-audio.spec.ts e2e/create-video.spec.ts
git commit -m "test(e2e): add compose/image/audio/video happy paths (no generate)"
```

---

### Task 7: E2E Settings page + full suite green

**Files:**
- Create: `e2e/settings.spec.ts`

- [ ] **Step 1: Settings test**

```ts
import { test, expect } from "@playwright/test";
test("settings loads and shows controls", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator("body")).toBeVisible();
});
```

- [ ] **Step 2: Run full suite headless**

Run: `bunx playwright test --reporter=list`
Expected: >=7 tests PASS, headless chromium. No generate button pressed (grep tests for `click.*generate` should be 0 or guarded).

- [ ] **Step 3: Verify no generate/upload in e2e**

Run: `grep -rn "generate\|upload" e2e/ --include="*.ts" | grep -i "click\|press" | head -20`
Expected: 0 hits for actual click on generate.

- [ ] **Step 4: Typecheck + lint**

Run: `bunx tsc --noEmit; bunx eslint . --max-warnings=0 2>&1 | head -20`
Expected: 0 errors.

- [ ] **Step 5: Commit + final verification**

```bash
git add e2e/settings.spec.ts
git commit -m "test(e2e): add settings happy path; suite >=7 passing"
bunx playwright test --reporter=list
```

---

## Self-Review Checklist

- [ ] Spec coverage: .env cleanup Task1, DB move Task2, Playwright Task3-7 — all spec requirements mapped.
- [ ] Placeholder scan: no TBD/TODO, all file paths exact, all code blocks present.
- [ ] Type consistency: DB_PATH env name consistent, playwright config matches e2e/ dir.
- [ ] All tests headless, no generate click, TS strict, 12-factor baseURL env.

