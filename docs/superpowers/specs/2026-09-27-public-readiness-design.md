# Public Readiness Fixes Design

Date: 2026-09-27. Task: make silicon-seeds publishable. Scope: 4 blockers + 2 minors. Hero images explicitly out of scope.

## Decisions (user-approved)

- F2 chroma path: env approach.
- F3 bind address: env approach (HOST override, safe default).
- F4 docs: ignore all of docs/, remove from history where present.
- M1 todo.txt: delete.
- M2 test script + README: document e2e, thorough README refresh as dedicated task from latest project state.

## F1: text-to-script hardcoded home path

File: `src/api/api/text-to-script.ts:16-19`. Currently `Bun.write(/home/dennis/work/silicon-seeds/content/scripts/...)`. Crashes on any other machine, leaks username.

Design: resolve base dir from `Bun.env.CONTENT_LIBRARY_DIR` (the documented persistent gallery dir), subfolder `scripts/`. Fallback to `<repo>/content/scripts` resolved relative to CWD when env missing. Ensure parent dir exists before write (Bun.write creates parents, but be explicit if needed). No new env var. Behavior otherwise unchanged (uuid filename, response shape).

## F2: db:chroma hardcoded path (env approach)

File: `package.json:26`. Currently `--path /home/dennis/content_library/chroma-data`.

Design: `bunx chroma run --path ${CONTENT_LIBRARY_DIR:-./content_library}/chroma-data --host 127.0.0.1 --port 8000`. npm/bun scripts do not expand shell vars portably, so delegate: change script to `bun src/script/chroma.ts` OR keep one-liner with sh -c wrapper. Preferred: tiny `src/script/chroma.ts` that reads `Bun.env.CONTENT_LIBRARY_DIR ?? "./content_library"` and spawns chroma with resolved path. Document in README env table (CONTENT_LIBRARY_DIR already required).

## F3: server bind address (env approach)

File: `src/api/api.tsx:15-22`. Currently `Bun.serve({port: 3000})` with no hostname, defaults to 0.0.0.0. App has no auth, so LAN exposure on public-repo clones is a real risk.

Design: `hostname: Bun.env.HOST ?? "127.0.0.1"`, port stays 3000 (or `Number(Bun.env.PORT ?? 3000)` for symmetry, minimal). Default loopback preserves current local-only posture. Add `HOST` (and `PORT` if added) to `.env.example` with comment. Log bound address at startup. README troubleshooting notes remote access is opt-in via HOST=0.0.0.0 with warning.

## F4: docs/ handling

Finding from history check (2026-09-27): `docs/bun.md`, `docs/kysely.md`, `docs/lm-studio.md`, `docs/daisyui.md` were NEVER tracked (`git log --all -- docs/bun.md` empty). Only `docs/superpowers/specs|plans` (8 files) are tracked. `.gitignore:151` already ignores `docs/`.

Design: keep `docs/` ignored. Do NOT history-rewrite (nothing sensitive to purge, rewrite would invalidate all SHAs for zero benefit). `git rm --cached` any reference doc if tracked (none are). Consequence: `AGENTS.md:27` instruction "read all documents in /docs" becomes dead for fresh clones, and its `~/work/silicon-seeds/...` absolute paths plus stale stack (HTMX/SSE, missing SolidJS/Hono/Tailwind) mislead contributors. So AGENTS.md must be updated in same branch: drop /docs mandate, use relative paths, correct stack + commands. Pipeline spec/plan files under `docs/superpowers/` commit with `git add -f` as truth artifacts.

## M1: delete src/prompts/todo.txt

Zero code references (rg 2026-09-27). Misleading name, holds a sample image prompt. Design: `git rm src/prompts/todo.txt`. No replacement (F1 keeps script example out of scope).

## M2: test script + README refresh (dedicated task)

`package.json:28` placeholder `test` exits 1. E2E exists (`e2e/*.spec.ts`, `playwright.config.ts`, `test:e2e*` scripts) but README never mentions it.

Design: `test` becomes `bunx tsc --noEmit && eslint .` (fast, no services). Keep `test:e2e` for Playwright (needs running servers). README gets: Testing section (unit/typecheck/lint vs e2e + service prereqs), env table gains HOST/PORT, chroma path note, corrected quick-start verified against current package.json + vite.config outDir + migration flow. README refresh is its own plan task with file-by-file verification (package.json scripts, src/main.ts entry, migrations dir, e2e dir), not prose-only.

## Out of scope

- readme/*.png binaries (hero 2.8M etc). Kept as-is per instruction.
- Static-file traversal hardening (`api.tsx:40,93,122`), unvalidated routes, CORS. Noted in audit, separate change.
- History rewrite for docs (no-op, see F4).

## Acceptance

- No `/home/dennis` string in tracked files except git history.
- Fresh clone + cp .env.example .env + bun install + db:migrate + build:css + start works without editing code.
- `HOST` unset binds loopback. `bun run test` green without services. `git ls-files | grep ^docs/` shows only pipeline specs/plans (force-added truth) or nothing, and `git log --all -- docs/bun.md` stays empty.
