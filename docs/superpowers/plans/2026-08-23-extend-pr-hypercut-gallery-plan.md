# Extend PR 56 + Hypercut Render Robustness + UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend PR 56 (`fix/gallery-perf-cache`) to include both gallery perf fixes and hypercut render robustness + UI polish from `feat/hypercut-timeline` so a single PR lands all fixes to master.

**Architecture:** Git merge of `feat/hypercut-timeline` (tip 3333c54) into `fix/gallery-perf-cache` (tip 3979e0a after gallery spec). Conflict resolution keeps gallery static/assets handler verbatim. Verification via `bunx tsc --noEmit`, `bun test`, curl header checks. No new code beyond merge resolution.

**Tech Stack:** Bun, Hono, `@hyperframes/core` lint, `@hyperframes/producer` render, Bun `gzipSync`, HTMX.

---

### Task 1: Merge feat/hypercut-timeline into fix/gallery-perf-cache

**Files:**
- Merge: `feat/hypercut-timeline` (3333c54) into `fix/gallery-perf-cache`
- Verify: `.git/MERGE_HEAD` state

- [ ] **Step 1: Ensure branches are present and up to date**

```bash
git fetch origin feat/hypercut-timeline fix/gallery-perf-cache 2>&1 | head -5
git branch -a | grep -E "feat/hypercut|fix/gallery"
```

Expected: both branches listed.

- [ ] **Step 2: Checkout fix/gallery-perf-cache (currently master 3979e0a ahead of origin/master)**

```bash
git checkout fix/gallery-perf-cache
git log --oneline -3
```

Expected: top commit 3979e0a docs spec extend, then 7f0495e gallery fix.

- [ ] **Step 3: Merge feat/hypercut-timeline**

```bash
git merge feat/hypercut-timeline --no-ff -m "merge: hypercut render robustness + UI polish into gallery perf PR" 2>&1 | tail -20
```

Expected: either clean merge or conflict in `src/api/api.tsx` (and maybe `package.json`, `bun.lock`). If clean, skip to Step 5.

- [ ] **Step 4: Resolve conflicts if any**

Check status:

```bash
git status --porcelain | head -30
```

If `src/api/api.tsx` conflicted, open it and ensure the gallery handler is kept:

- Keep the custom `isCompressibleContentType` + `app.use("/static/*", async (c)=>{...})` block with Cache-Control 3600 must-revalidate, ETag 304, Vary, gzip, Accept-Ranges (from gallery branch).
- Keep the `/assets/*` handler with Vary, Accept-Ranges, gzip for text, Range 206 (from gallery branch).
- Keep hypercut route mounts from feat branch (e.g., `hypercut.ts` import and route registration) — do not drop.

For `package.json`/`bun.lock`: keep the union (hypercut deps + existing). Run:

```bash
bun install 2>&1 | tail -5
```

Then:

```bash
git add src/api/api.tsx package.json bun.lock 2>&1 | head -5
git status --porcelain
```

- [ ] **Step 5: Commit merge (if not auto-committed)**

```bash
git status
# if still merging:
git commit -m "merge: hypercut render robustness + UI polish into gallery perf PR" --no-edit 2>&1 | head -10
git log --oneline --graph -8 | head -15
```

Expected: merge commit with two parents: fix/gallery-perf-cache and feat/hypercut-timeline.

- [ ] **Step 6: Verify file presence**

```bash
ls src/hypercut/ | head -20
cat src/hypercut/render-orchestrator.ts | head -5 2>&1 | head -10
ls docs/superpowers/specs/ 2>&1 | head -20
```

Expected: `src/hypercut/` dir exists with `render-orchestrator.ts`, `composition-validator.ts`, etc.

---

### Task 2: Resolve typecheck and ensure gallery handlers still correct after merge

**Files:**
- Modify: `src/api/api.tsx` (if merge mangled gallery handler)
- Check: `studio/src/App.tsx` ( Timeline import per memory fix)

- [ ] **Step 1: Read merged api.tsx and verify static/assets handlers**

```bash
grep -n "Cache-Control\|Content-Encoding\|Accept-Ranges\|isCompressibleContentType" src/api/api.tsx | head -20
```

Expected: static returns `public, max-age=3600, must-revalidate`, assets `public, max-age=31536000, immutable`, both have Vary, gzip logic.

If missing, re-apply gallery handler from `git show master:src/api/api.tsx` excerpt:

```ts
function isCompressibleContentType(ct: string): boolean {
  return (ct.startsWith("text/") || ct === "application/json" || ct === "application/javascript" || ct === "text/css" || ct === "image/svg+xml");
}
app.use("/static/*", async (c) => {
  const filePath = `.${c.req.path}`;
  const file = Bun.file(filePath);
  if (await file.exists()) {
    const contentType = filePath.endsWith(".css") ? "text/css; charset=utf-8" : filePath.endsWith(".js") ? "application/javascript; charset=utf-8" : Utils.getContentType(filePath);
    const stats = await file.stat();
    const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
    const ifNoneMatch = c.req.header("If-None-Match");
    if (ifNoneMatch === etag) return new Response(null, {status:304, headers:{ETag:etag,"Cache-Control":"public, max-age=3600, must-revalidate",Vary:"Accept-Encoding"}});
    const acceptEnc = c.req.header("Accept-Encoding")||"";
    const shouldCompress = acceptEnc.includes("gzip") && isCompressibleContentType(contentType) && stats.size > 1024;
    if (shouldCompress) { const buf=await file.arrayBuffer(); const compressed=Bun.gzipSync(Buffer.from(buf)); return new Response(compressed as unknown as BodyInit,{status:200,headers:{"Content-Type":contentType,"Content-Length":compressed.length.toString(),"Cache-Control":"public, max-age=3600, must-revalidate",ETag:etag,Vary:"Accept-Encoding","Content-Encoding":"gzip","Accept-Ranges":"bytes"}});}
    return new Response(file as unknown as BodyInit,{status:200,headers:{"Content-Type":contentType,"Cache-Control":"public, max-age=3600, must-revalidate",ETag:etag,Vary:"Accept-Encoding","Accept-Ranges":"bytes"}});
  }
  Logger.warn(`${filePath} not found`);
  return c.text("Not found",404);
});
```

Commit fix if edited:

```bash
git add src/api/api.tsx
git commit -m "fix: preserve gallery cache/compression handlers after hypercut merge" 2>&1 | head -10
```

- [ ] **Step 2: Verify App.tsx does not import Timeline without provider (per memory 100%)**

```bash
grep -n "Timeline" studio/src/App.tsx 2>&1 | head -10
cat studio/src/App.tsx | head -80 2>&1 | head -40
```

Expected: no `Timeline` import; uses `PlayerControls`. If `Timeline` still present, remove it.

```bash
git add studio/src/App.tsx
git commit -m "fix: remove Timeline import without provider" 2>&1 | head -10
```

- [ ] **Step 3: Run typecheck**

```bash
bunx tsc --noEmit 2>&1 | tail -30
```

Expected: no errors. If errors, fix imports before proceeding.

---

### Task 3: Verify build, tests, and manual header checks

**Files:** none — verification

- [ ] **Step 1: Run hypercut tests**

```bash
bun test src/hypercut/ 2>&1 | tail -40
```

Expected: all tests pass (≈19 tests or more from feat branch). Note count.

- [ ] **Step 2: Build CSS (or generic build if exists)**

```bash
bun run build:css 2>&1 | tail -10
# optional: bun run build 2>&1 | tail -10 if exists
```

Expected: succeeds.

- [ ] **Step 3: Start server and curl-check headers (if server can run)**

```bash
# in background:
bun start:hot &; sleep 5; curl -s -I http://localhost:3000/static/style.css | grep -i "Cache-Control\|ETag\|Vary" | head -5; curl -s -H "Accept-Encoding: gzip" -I http://localhost:3000/static/style.css | grep -i "Content-Encoding" | head -5; pkill -f "bun start:hot" || true
```

Expected: Cache-Control present, ETag present, Vary present, Content-Encoding gzip when requested. If server not startable in test env, skip with note.

- [ ] **Step 4: Commit if any verification fixes needed (else no commit)**

---

### Task 4: Update PR 56 branch push and description

**Files:** none — git push + gh pr edit

- [ ] **Step 1: Push fix/gallery-perf-cache to origin**

```bash
git push origin fix/gallery-perf-cache 2>&1 | tail -10
```

Expected: push succeeds (force not needed as merge is forward).

- [ ] **Step 2: Update PR body to reflect extended scope**

```bash
gh pr view 56 --json body --jq .body | head -20
gh pr edit 56 --body "Extends gallery perf + hypercut render robustness + UI polish per specs:
- 2026-08-23 gallery perf: static/assets cache + ETag + gzip + gallery lazy
- 2026-06-19 hypercut render robustness: renderWithValidation, diagnostics, composition-validator, gsap-to-css, lint programmatic, agentic-editor fix, api error bodies (400/500)
- UI: unique clipIds, SSE job-complete, drag-to-resize sidebars, render retry, Studio sync before suggestions, full-height layout, tabs Chat/Render, remove Timeline without provider

Verified: bunx tsc --noEmit, bun test src/hypercut/, curl header checks." 2>&1 | head -10
```

- [ ] **Step 3: Verify PR diff**

```bash
gh pr diff 56 --stat 2>&1 | tail -30
git log --oneline --graph origin/master..fix/gallery-perf-cache | head -20
```

Expected: PR now shows ~50+ files (hypercut + gallery) plus docs.

