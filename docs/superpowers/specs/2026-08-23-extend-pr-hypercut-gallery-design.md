# Extend PR 56 — Gallery Perf + Hypercut Render Robustness + UI Polish — Design

## 2026-08-23

## Problem

PR 56 (`fix/gallery-perf-cache`) currently only contains gallery perf fixes (static cache+ETag+gzip, assets Vary+Range+gzip, gallery lazy). The `feat/hypercut-timeline` branch (3333c54) contains ~40 commits of hypercut render robustness + UI polish that are `CLOSED` not `MERGED` (PR 53 closed) and not on `master`/`origin/master` (d909327). Master is ahead with gallery fixes but missing hypercut work, so the project has divergent fixes.

Goal of this change: extend PR 56 to be the single integration PR that lands **both** gallery perf **and** hypercut fixes, so `master` gets both in one merge.

### Gallery perf (already in PR 56, keep)

Spec: `2026-08-23-gallery-perf-asset-cache-design.md` — cache-control, ETag 304, Vary, gzip for static/assets, `loading=lazy` etc. Already implemented in 7f0495e. No regression.

### Hypercut render robustness (from `feat/hypercut-timeline`, not yet in master)

From spec `2026-06-19-hypercut-render-robustness-design.md` (on feat branch) + `2026-06-19-render-bug-ui-tabs-design.md`:

Symptom A: ffmpeg render failed with empty `compiled/index.html` (0 bytes), 0 captured frames, cryptic "no streams" error. Root cause: compiler returned empty HTML, pipeline did not detect before encode.

Symptom B: lint warnings `gsap_studio_edit_blocked` from GSAP tweens on clip elements, plus 3 errors on empty compiled file (dead after fix).

Symptom C: UI polish missing: sidebar drag broken, suggestion clipIds not unique, missing SSE job-complete event, no drag-to-resize sidebars, render retry missing, Studio composition not synced before suggestions, no full-height layout, scroll/align bugs, etc. Commits 26d09ad..3333c54 fix these.

## Goals

1. Merge `feat/hypercut-timeline` changes into `fix/gallery-perf-cache` so PR 56 covers gallery + hypercut.
2. No regressions: `bunx tsc --noEmit`, `bun test`, `bun run build:css` pass; `/static/*` and `/assets/*` still serve with correct cache/compression headers; hypercut render path uses `renderWithValidation` + diagnostics.
3. Resolve merge conflicts in `src/api/api.tsx` (gallery static handler vs hypercut route mounts) deterministically.

## Non-goals

- No new hypercut features beyond what is on `feat/hypercut-timeline` at 3333c54.
- No CDN, no thumbnail generation.
- No patching of `@hyperframes/producer` internals.

## Architecture

### Branch strategy

```
origin/master (d909327) ──► fix/gallery-perf-cache (7f0495e: gallery fixes)
                                      │
feat/hypercut-timeline (3333c54) ─────┘ merge (or cherry-pick 8acf1e0..3333c54)
                                      ▼
                              fix/gallery-perf-cache (extended) ──► PR 56 update ──► master
```

Preferred: `git checkout fix/gallery-perf-cache && git merge feat/hypercut-timeline --no-ff` (preserves history). If conflicts, resolve manually, prefer gallery static/assets handler (newer, correct) over hypercut's older `serveStatic` no-op.

Alternative: `git cherry-pick` range if merge brings unwanted .oneshot-state or unrelated wip commits — but merge is cleaner as feat branch is already rebased on 3a8bf17 (which is ancestor of d909327, so common base exists).

### Components to land

From `git diff origin/master..feat/hypercut-timeline --stat` (abridged):

- `src/hypercut/*`: `composition-validator`, `gsap-to-css`, `render-orchestrator`, `agentic-editor`, `whisperx-parser`, `hypercut-workflow`, etc. + tests
- `src/api/api/hypercut.ts`: `renderWithValidation` wrapper, HTML fragment API for render, error bodies 400/500
- `src/templates/hypercut.tsx`, `src/templates/agent-chat.tsx`: tabs, Studio iframe, suggestions panel
- `static/js/*`: `hypercut-bridge.js`, `hypercut-workspace.js`, `agent-chat.js` fixes
- `src/db/db.ts`, `migrations/*`: hypercut tables
- Plus gallery fixes already present.

### Conflict resolution

Only expected conflict: `src/api/api.tsx`. Gallery branch replaced `serveStatic` no-op with custom `Bun.file` handler + gzip + ETag; hypercut branch added route mounts and maybe kept old `serveStatic`. Resolution: keep gallery handler verbatim for `/static/*` and `/assets/*`, keep hypercut route mounts (`hypercut.ts` routes) below.

### Data flow (unchanged)

Hypercut compose → `HyperCutWorkflow.render` → `renderWithValidation` (pre-validate source HTML via `lintCompositionHtml`, throw 400 on failure) → producer pipeline → post-diagnostics (check `compiled/index.html` bytes, captured-frames, output bytes, throw 500 on failure) → SSE `job-complete`.

Gallery: `GET /static/*` → ETag check → gzip if compressible + Accept-Encoding → 200/304. `GET /assets/*` → ETag/Range → Vary + gzip for text only → 200/206/304.

## Error Handling

- Merge conflict: abort merge, resolve `api.tsx` manually, `git add && git commit`.
- If `bunx tsc` fails after merge: fix imports (e.g., `@hyperframes/studio` Timeline removed earlier per memory) — ensure `studio/src/App.tsx` does not import `Timeline` without provider.
- If tests fail: inspect `src/hypercut/*.test.ts` — those tests expect `lintCompositionHtml` from `@hyperframes/core`, verify import path.

## Testing

- `bunx tsc --noEmit` passes
- `bun test` — hypercut tests (19 tests) pass; no existing suite for gallery (manual curl)
- `curl -I` checks: static returns `Cache-Control: public, max-age=3600, must-revalidate` + `Content-Encoding: gzip` when `Accept-Encoding: gzip`; assets returns `Accept-Ranges: bytes` + `Vary`
- Manual hypercut composition validator: `bun test src/hypercut/composition-validator.test.ts`

## Success Criteria

- `git log --oneline --graph` shows `fix/gallery-perf-cache` contains both gallery (7f0495e) and hypercut (3333c54) histories.
- `gh pr view 56 --json headRefName` still `fix/gallery-perf-cache` with extended diff (gallery + hypercut files) and no merge conflicts markers.
- `bunx tsc --noEmit` green, `bun test` green.
- PR 56 body updated to list both gallery and hypercut changes.

## Open Questions

- Keep `gsap-to-css` converter but not used in `autoFixLint` per latest UI-tabs spec (CSS breaks deterministic render). Follow latest commit 67be9ec behavior: GSAP fromTo with position param, no CSS conversion for clip elements.

