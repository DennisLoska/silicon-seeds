# Cleanup Dead Code — Design

## Context
Repo after SolidJS rewrite (2026-08-28). Task: delete dead pages/integrations where clearly empty. Candidates: home page (Dashboard), settings page, youtube (yt-dlp), whisper (WhisperX), playwright scripts.

Investigation done via code search (src/ scan, grep for imports).

## Findings (evidence)

- **Dashboard/Home** (`src/client/pages/Dashboard.tsx:1`): single Hello World placeholder. Routes `/` and `/dashboard` in `src/client/App.tsx:14-31` both render it. Nav link in `src/client/components/Layout.tsx:52-58`. No other logic, no API calls, no state.
- **Settings** (`src/client/pages/Settings.tsx:1`): placeholder "No settings configured yet". Route `/settings` in `App.tsx:104-110`, nav entry `Layout.tsx:111-114`. No settings logic elsewhere (theme is in `src/client/stores/theme.tsx`, not this page).
- **YouTube / yt-dlp** (`src/yt/yt.ts:1-136`): namespace `YtDlp` (list, downloadAudio/Video). Only consumer is `src/script/wip.ts:11,125,135,151` (experimental pipeline marked `// TODO delete this garbage`). No autocut, no API route, no queue usage. `YT_DLP` env asserted but never set in production path.
- **WhisperX** (`src/whisperx/whisperx.ts:1-51`): namespace `WhisperX.run`. Used by `src/autocut/autocut-workflow.ts:24,1125` (production AutoCut transcription) **and** `src/script/wip.ts:10,177`. So **not dead** — production dependency. Only wip usage is dead.
- **Playwright** (`src/utils/playwright.ts:1-205`): `Playwright.takeScreenshots` + cookie dismissal. Only consumer `src/script/wip.ts:7, urls_to_screenshots`. No `playwright.config.*`, no tests (package.json `test` script is echo error). `@playwright/test` and `playwright` deps pulled but unused in prod.
- **WIP script** (`src/script/wip.ts:1-434`): experimental end-to-end (YouTube download → WhisperX → LLM scoring → ffmpeg trim + screenshot helper). Header says `// MEMO: Find proper APIs online` and `// TODO delete this garbage`. Not imported anywhere else.

## Decision

- **Delete**: Dashboard page + routes + nav; Settings page + route + nav; `src/yt/`; `src/utils/playwright.ts`; `src/script/wip.ts`.
- **Keep**: `src/whisperx/` (required by AutoCut). Remove only the wip import/use, not the module itself.
- **Deps**: remove `@playwright/test` (and `playwright` transitive) from `package.json` **only if** no other file imports it after deletions. Verify via `grep -r playwright` after edits.
- **Icons**: keep `Icons.Dashboard` / `Icons.Settings` in `src/client/components/Icons.tsx` **unless** orphaned — if Dashboard/Settings routes gone, those icons become unused but keep for now (low cost, may be reused). Decision: remove nav links, leave icon definitions (not dead weight).
- **Root redirect**: after removing `/` dashboard, `/` should redirect to `/jobs` (primary view). Keep `/dashboard` → redirect to `/jobs` for bookmark compatibility or 404; prefer redirect to avoid broken links.

## Approaches Considered

1. **Minimal delete (chosen)**: remove files/routes/nav as above, keep whisperx, keep icons, redirect `/`. Minimal risk, preserves AutoCut. Pros: no behavior change for production. Cons: leaves some orphan icons.
2. **Aggressive delete**: also delete `src/whisperx/`, `@playwright/test` dep, and icon exports. Rejected: breaks AutoCut; dep removal needs full verify.
3. **Defer / no delete**: leave placeholders. Rejected: task explicitly asks cleanup; placeholders add nav clutter.

## Architecture & Files

- Files to delete:
  - `src/client/pages/Dashboard.tsx`
  - `src/client/pages/Settings.tsx`
  - `src/yt/yt.ts` (and `src/yt/` dir if empty)
  - `src/utils/playwright.ts`
  - `src/script/wip.ts`
- Files to edit:
  - `src/client/App.tsx`: remove Dashboard/Settings lazy imports, replace `/` and `/dashboard` routes with redirect (Navigate) to `/jobs`, remove `/settings` route
  - `src/client/components/Layout.tsx`: remove Dashboard nav `<A href="/dashboard">`, Settings nav, update `getPageTitle` (remove dashboard/settings cases), adjust menu titles
  - `package.json`: remove `@playwright/test` dep if confirmed unused after file deletions
- Keep untouched: `src/whisperx/whisperx.ts`, `src/autocut/*`, `src/prompts/prompt-generator.ts` (whisper types), `src/client/stores/theme.tsx`

## Data Flow & Behavior

- Navigation: sidebar loses Dashboard/Settings entries; main drawer still works.
- Routing: hitting `/` or `/dashboard` now lands on Jobs list; `/settings` 404s (or redirects if we choose).
- Build: Vite solid router must still compile; no missing imports.
- Queue/AutoCut: unchanged — WhisperX still available.

## Error Handling

- If user bookmarks `/settings` or `/dashboard`, they get redirect/404 — acceptable for deprecated empty pages.
- `pnpm/bun build` must pass; `tsc --noEmit` must pass; no runtime imports of deleted modules.
- Guard: grep after edits for `Dashboard`, `Settings`, `YtDlp`, `Playwright`, `wip` to ensure no dangling imports.

## Testing Strategy

- No existing test suite (package.json test is placeholder). Verification via:
  - `bunx tsc --noEmit` (or `tsc --noEmit`) — typecheck
  - `bun run build:css` / vite build if present — ensure Solid build compiles
  - Manual curl or dev server smoke: fetch `/` returns redirect/HTML with jobs
  - Grep for leftover imports

## Open Questions (resolved)

- Q: Is Whisper dead? A: No — AutoCut uses it. Keep module.
- Q: Is yt-dlp used elsewhere? A: No — only wip. Delete.
- Q: What does `/` do after? A: Redirect to `/jobs`.

## Success Criteria

- `src/client/pages/Dashboard.tsx` and `Settings.tsx` gone
- Routes for `/`, `/dashboard`, `/settings` removed/redirected
- Sidebar no longer shows Dashboard/Settings
- `src/yt/yt.ts` and `src/utils/playwright.ts` and `src/script/wip.ts` gone
- `src/whisperx/whisperx.ts` still exists and autocut still imports it
- Project typechecks and builds
- No grep hits for deleted modules (except maybe icon definitions)
