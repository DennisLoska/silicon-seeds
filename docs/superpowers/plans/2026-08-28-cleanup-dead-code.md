# Cleanup Dead Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove empty Dashboard/Settings pages and dead YouTube/Playwright/wip code, redirect root to jobs, keep WhisperX.

**Architecture:** Delete 5 files/dirs, edit 2 frontend files (App.tsx, Layout.tsx) to remove routes/nav and add redirect, optionally prune `@playwright/test` dep. No new abstractions.

**Tech Stack:** SolidJS router, Bun, TypeScript, DaisyUI

---

### Task 1: Delete dead backend/script files

**Files:**
- Delete: `src/yt/yt.ts` (and dir `src/yt/` if empty)
- Delete: `src/utils/playwright.ts`
- Delete: `src/script/wip.ts`
- Modify: none

- [ ] **Step 1: Verify files are dead before deleting**

Run:
```bash
grep -r "from.*yt/yt\|from.*utils/playwright\|script/wip" src --include="*.ts" --include="*.tsx" | grep -v node_modules
```
Expected: hits only in `src/script/wip.ts` itself (and wip's own imports). Also check:
```bash
grep -rn "YtDlp\|Playwright\|WhisperX" src --include="*.ts" | grep -v "src/whisperx" | grep -v "src/autocut" | grep -v "src/prompts"
```
WhisperX should still have hits in `src/autocut/autocut-workflow.ts` (keep). YtDlp/Playwright should only hit wip.

- [ ] **Step 2: Delete the three files**

Run:
```bash
rm src/yt/yt.ts src/utils/playwright.ts src/script/wip.ts
rmdir src/yt 2>/dev/null || true
ls src/yt src/utils/playwright.ts src/script/wip.ts 2>&1
```
Expected: `No such file` for all three. `src/yt` dir gone.

- [ ] **Step 3: Typecheck that no broken imports remain**

Run:
```bash
bunx tsc --noEmit 2>&1 | head -n 50
```
Expected: no errors about missing `yt/yt` or `utils/playwright`. If errors, fix import leftovers (should be none since only wip imported them).

- [ ] **Step 4: Commit**

```bash
git add -A && git status
git commit -m "chore: delete dead yt/playwright/wip code"
```

---

### Task 2: Delete Dashboard and Settings pages, update router

**Files:**
- Delete: `src/client/pages/Dashboard.tsx`
- Delete: `src/client/pages/Settings.tsx`
- Modify: `src/client/App.tsx`

- [ ] **Step 1: Read current App.tsx to confirm routes**

Read `src/client/App.tsx` — expect lazy imports for Dashboard/Settings and routes for `/`, `/dashboard`, `/settings`.

- [ ] **Step 2: Delete page files**

Run:
```bash
rm src/client/pages/Dashboard.tsx src/client/pages/Settings.tsx
ls src/client/pages/
```
Expected: remaining pages: AutoCut, Compose, CreateAudio, CreateImage, Gallery, Jobs (no Dashboard/Settings).

- [ ] **Step 3: Edit App.tsx to remove dead routes and redirect root**

Replace in `src/client/App.tsx`:

Remove:
```ts
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));
```

Add redirect import:
```ts
import { Navigate } from "@solidjs/router";
```

Replace routes:
- `path="/"` → `component={() => <Navigate href="/jobs" />}`
- `path="/dashboard"` → `component={() => <Navigate href="/jobs" />}` (keep for bookmark compat, redirect)
- Remove `path="/settings"` entirely

Final `App.tsx` should have lazy imports only for Jobs, Gallery, Compose, AutoCut, CreateImage, CreateAudio, plus Navigate redirect for `/` and `/dashboard`.

Full expected `App.tsx` after edit (trimmed):
```tsx
import { Router, Route, Navigate } from "@solidjs/router";
import { lazy, Suspense } from "solid-js";
import Layout from "./components/Layout";

const Jobs = lazy(() => import("./pages/Jobs"));
const Gallery = lazy(() => import("./pages/Gallery"));
const Compose = lazy(() => import("./pages/Compose"));
const AutoCut = lazy(() => import("./pages/AutoCut"));
const CreateImage = lazy(() => import("./pages/CreateImage"));
const CreateAudio = lazy(() => import("./pages/CreateAudio"));

export default function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={() => <Navigate href="/jobs" />} />
      <Route path="/dashboard" component={() => <Navigate href="/jobs" />} />
      // ... rest unchanged, no Dashboard/Settings routes
    </Router>
  );
}
```

- [ ] **Step 4: Verify no dangling imports**

Run:
```bash
grep -rn "Dashboard\|Settings" src/client --include="*.ts" --include="*.tsx" | grep -v "Icons" | head -n 20
```
Expected: only Layout still references settings/dashboard until Task 3 cleans it. App.tsx should have zero Dashboard/Settings hits.

- [ ] **Step 5: Commit**

```bash
git add src/client/App.tsx src/client/pages/
git commit -m "chore: delete Dashboard/Settings pages, redirect root to jobs"
```

---

### Task 3: Update Layout nav and titles

**Files:**
- Modify: `src/client/components/Layout.tsx`

- [ ] **Step 1: Edit Layout.tsx — remove nav links and title cases**

In `getPageTitle`, remove:
```ts
if (path === "/" || path.startsWith("/dashboard")) return "Dashboard";
if (path.startsWith("/settings")) return "Settings";
```
Add fallback: `if (path === "/" || path.startsWith("/dashboard")) return "Jobs";` or just let default handle (or map to Jobs).

In sidebar JSX, delete the two `<li>` blocks for Dashboard and Settings (ids `sidebar-dashboard-link` and `sidebar-settings-link`). Keep Jobs, Gallery, Create section.

Optional: remove `menu-title "System"` if it only held Settings — if empty, delete that header.

- [ ] **Step 2: Verify no dead links**

Run:
```bash
grep -n "dashboard\|settings" src/client/components/Layout.tsx -i
```
Expected: no hits (or only comment).

- [ ] **Step 3: Commit**

```bash
git add src/client/components/Layout.tsx
git commit -m "chore: remove Dashboard/Settings nav and titles"
```

---

### Task 4: Prune playwright dependency (if still unused)

**Files:**
- Modify: `package.json`
- Maybe: `bun.lock` after install

- [ ] **Step 1: Confirm no remaining playwright imports**

Run:
```bash
grep -r "playwright" --include="*.ts" --include="*.tsx" --include="*.json" src package.json | grep -v node_modules | grep -v ".spec" | head -n 20
```
Expected: only mention is `package.json` dep itself. No source imports.

- [ ] **Step 2: Remove dep if confirmed unused**

Run:
```bash
# edit package.json: remove "@playwright/test": "^1.60.0" from devDependencies or dependencies wherever it lives
bun remove @playwright/test 2>&1 | head -n 20
# or manually edit package.json then:
# bun install
```
Expected: package.json no longer lists `@playwright/test`. Note: `playwright` transitive dep will also go away.

If removal causes lockfile churn, include it.

- [ ] **Step 3: Typecheck/build still passes**

Run:
```bash
bunx tsc --noEmit 2>&1 | head -n 30
```
Expected: clean (no playwright errors).

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: remove unused @playwright/test dep"
```

If dep is kept (e.g., team wants it for future e2e), skip removal and just commit no-op with note — but default is remove.

---

### Task 5: Verification (no code changes, just checks)

**Files:** none

- [ ] **Step 1: Run typecheck**

```bash
bunx tsc --noEmit
# also check client tsconfig
bunx tsc -p src/client/tsconfig.json --noEmit 2>&1 | head -n 30
```
Expected: exit 0.

- [ ] **Step 2: Run vite build smoke**

```bash
npx vite build --config src/client/../vite.config.ts 2>&1 | head -n 50
# fallback: try bun run build if script exists, else just check vite can resolve imports
grep -rn "from.*pages/Dashboard\|from.*pages/Settings\|from.*yt/yt\|from.*utils/playwright" src --include="*.ts" --include="*.tsx" | wc -l
```
Expected: 0 hits, build succeeds.

- [ ] **Step 3: Confirm whisperx preserved**

```bash
ls src/whisperx/whisperx.ts
grep -n "WhisperX" src/autocut/autocut-workflow.ts | head -n 5
```
Expected: file exists, autocut still imports it.

- [ ] **Step 4: No leftover git ignored files**

```bash
git status --porcelain
```
Expected: only expected deletions/modifications, no untracked junk.

```
