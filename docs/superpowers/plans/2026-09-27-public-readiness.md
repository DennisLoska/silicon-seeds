# Public Readiness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove machine-specific paths, safe-bind server via env, keep docs/ out of repo, delete stale prompt file, working test script + accurate README.

**Architecture:** Six small isolated edits on branch `chore/public-readiness`, each verified by grep + typecheck before commit. No refactors, no behavior changes beyond env configurability.

**Tech Stack:** Bun, TypeScript, Hono (Bun.serve), package.json scripts, markdown docs.

---

### Task 1: F1 text-to-script env path

**Files:**
- Modify: `src/api/api/text-to-script.ts`
- Test: grep for hardcoded path (no test suite in repo)

- [ ] **Step 1: Replace hardcoded write path with env-based resolution**

```typescript
import { join } from "node:path";
import { TextGenerator } from "../../text/text-generator";

export async function text_to_script(prompt: string) {
  // TODO get these from query parameters
  // const prompt =
  // "The symbolism of baptism, creation, the void, the flood, a new creation and how they all are connected.";

  const res = await TextGenerator.create_script(prompt);

  if (res === null) {
    return new Response(JSON.stringify({ message: "Computer says no" }), {
      status: 500,
    });
  }

  const scriptsDir = Bun.env.SCRIPTS_DIR
    ?? join(Bun.env.CONTENT_LIBRARY_DIR ?? join(process.cwd(), "content"), "scripts");

  await Bun.write(join(scriptsDir, `${Bun.randomUUIDv7()}.md`), res);

  return new Response(JSON.stringify({ message: res }));
}
```

Keep existing `join` import style consistent with repo (check `src/meta/meta.ts` for path join convention first; use whatever repo uses).

- [ ] **Step 2: Verify no hardcoded home path remains**

Run: `rg -n "/home/dennis" src/ package.json .env.example 2>/dev/null`
Expected: no output in `src/api/api/text-to-script.ts` (other pre-existing hits, if any, listed for follow-up, not fixed here).

- [ ] **Step 3: Typecheck the file**

Run: `bunx tsc --noEmit 2>&1 | head -n 20`
Expected: no new errors in `text-to-script.ts` (pre-existing `Icons.tsx` client errors are out of scope).

- [ ] **Step 4: Commit**

```bash
git add src/api/api/text-to-script.ts
git commit -m "fix: text-to-script writes under CONTENT_LIBRARY_DIR, not hardcoded home path"
```

### Task 2: F2 db:chroma env path

**Files:**
- Modify: `package.json`
- Create: `src/script/chroma.ts`
- Test: `bun src/script/chroma.ts --help` dry check + grep

- [ ] **Step 1: Create src/script/chroma.ts launcher**

```typescript
const libraryDir = Bun.env.CONTENT_LIBRARY_DIR ?? join(process.cwd(), "content_library");
const dataPath = join(libraryDir, "chroma-data");
const port = Bun.env.CHROMADB_PORT ?? "8000";
const host = Bun.env.CHROMADB_HOST ?? "127.0.0.1";

const proc = Bun.spawn(
  ["bunx", "chroma", "run", "--path", dataPath, "--host", host, "--port", port],
  { stdio: ["inherit", "inherit", "inherit"] },
);
await proc.exited;
```

Check existing `src/script/batch-metadata.ts` header for import convention (`join` from `node:path` vs `path`), match it.

- [ ] **Step 2: Point package.json script at launcher**

Replace: `"db:chroma": "bunx chroma run --path /home/dennis/content_library/chroma-data --host 127.0.0.1 --port 8000"`
With: `"db:chroma": "bun src/script/chroma.ts"`

- [ ] **Step 3: Verify**

Run: `rg -n "/home/dennis" package.json src/script/chroma.ts`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add package.json src/script/chroma.ts
git commit -m "fix: db:chroma resolves path from CONTENT_LIBRARY_DIR"
```

### Task 3: F3 server bind via HOST/PORT env

**Files:**
- Modify: `src/api/api.tsx`
- Modify: `.env.example`
- Test: boot check + grep

- [ ] **Step 1: Add hostname + port env to Bun.serve**

In `src/api/api.tsx`, inside `ApiServer.start()`:

```typescript
server = Bun.serve({
  hostname: Bun.env.HOST ?? "127.0.0.1",
  port: Number(Bun.env.PORT ?? 3000),
  idleTimeout: Metadata.TIMEOUT,
  maxRequestBodySize: MAX_REQUEST_BODY_SIZE,
  fetch: app.fetch,
});
```

- [ ] **Step 2: Add HOST/PORT to .env.example**

```bash
# Server bind (loopback default; set HOST=0.0.0.0 only on trusted networks, app has no auth)
HOST=127.0.0.1
PORT=3000
```

- [ ] **Step 3: Verify default bind is loopback**

Run: `rg -n "hostname|Bun.env.HOST" src/api/api.tsx`
Expected: `hostname: Bun.env.HOST ?? "127.0.0.1"` present.

- [ ] **Step 4: Typecheck + commit**

Run: `bunx tsc --noEmit 2>&1 | head -n 20`
Expected: no new errors in `api.tsx`.

```bash
git add src/api/api.tsx .env.example
git commit -m "fix: server binds loopback by default, HOST/PORT configurable"
```

### Task 4: F4 docs ignored + AGENTS.md refresh

**Files:**
- Verify: `.gitignore` (docs/ line already at :151)
- Modify: `AGENTS.md`
- Test: `git ls-files | grep ^docs/` + `git check-ignore`

- [ ] **Step 1: Confirm reference docs untracked and ignored**

Run: `git ls-files | grep ^docs/ ; echo "---"; git check-ignore -v docs/bun.md docs/kysely.md docs/lm-studio.md docs/daisyui.md`
Expected: first command shows only `docs/superpowers/*` pipeline files; second shows all four ignored via `.gitignore`.

- [ ] **Step 2: Rewrite AGENTS.md (relative paths, correct stack, no /docs mandate)**

Replace absolute `~/work/silicon-seeds/...` paths with relative. Replace stale stack (HTMX) with actual: Bun, Hono, SolidJS + DaisyUI + Tailwind, SSE + WebSockets, SQLite + Kysely. Drop "read all documents in /docs" mandate (docs/ not in repo). Keep: `bun run start:hot`, health check, .env setup, migration + css build commands verified against package.json.

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: AGENTS.md works for fresh clones (no /docs, relative paths, correct stack)"
```

Note: `docs/superpowers` pipeline specs/plans stay tracked as work record (already in history). No `git rm --cached`, no history rewrite per user 2026-09-27.

### Task 5: M1 delete src/prompts/todo.txt

**Files:**
- Delete: `src/prompts/todo.txt`
- Test: grep references

- [ ] **Step 1: Confirm zero references, delete**

Run: `rg -n "prompts/todo|todo\.txt" src/ e2e/ README.md AGENTS.md 2>/dev/null`
Expected: no output (verified 2026-09-27, re-confirm).

```bash
git rm src/prompts/todo.txt
git commit -m "chore: remove misnamed src/prompts/todo.txt sample prompt"
```

### Task 6: M2 test script + thorough README refresh

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Test: `bun run test`, cross-check every command against repo

- [ ] **Step 1: Replace placeholder test script**

Replace: `"test": "echo \"Error: no test specified\" && exit 1"`
With: `"test": "bunx tsc --noEmit && eslint ."`
Keep `test:e2e*` untouched.

- [ ] **Step 2: Run new test script, record baseline**

Run: `bun run test 2>&1 | tail -n 20`
Expected: tsc passes on server files; note pre-existing client `Icons.tsx` errors if they fail the gate, report back rather than fixing (out of scope), or scope-fix only if trivially blocking.

- [ ] **Step 3: Audit README against latest project state (file-by-file)**

Verify each claim before writing: every `package.json` script name referenced exists; `vite.config.ts` outDir vs documented `dist/client`; `migrations/` flow (`db:migrate`/`db:rollback`); `e2e/` files list matches documented coverage; env table matches `.env.example` keys exactly (HOST/PORT/CONTENT_LIBRARY_DIR/SCRIPTS_DIR if added); service URLs match code defaults (`src/chroma/chroma.ts`, `src/tts/tts.ts`, COMFYUI/LM Studio); entry `src/main.ts` + ports. Rewrite stale sections (HTMX references if any, old paths).

- [ ] **Step 4: Add Testing section to README**

Document: `bun run test` (typecheck + lint, no services) vs `bun run test:e2e` (Playwright, needs app + ComfyUI + LM Studio running). Include service prereqs.

- [ ] **Step 5: Commit**

```bash
git add package.json README.md
git commit -m "docs: working test script, README verified against current tree"
```

### Task 7: Final verification + push + PR

- [ ] **Step 1: Full verification**

Run: `bun run test 2>&1 | tail -n 5`
Run: `rg -n "/home/dennis" src/ package.json .env.example e2e/ README.md AGENTS.md 2>/dev/null`
Expected: tests green (or only pre-existing client errors reported), zero home-path hits.

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin chore/public-readiness
gh pr create --title "chore: public-readiness fixes (paths, bind, docs, test, README)" --body "Spec: docs/superpowers/specs/2026-09-27-public-readiness-design.md"
```

Record PR URL for Phase 5/6.
