# Spec: ESLint + TypeScript Cleanup

Date: 2026-08-30
Branch: chore/eslint-typecheck-cleanup
Status: draft

## 1. Problem & Goal
`bunx tsc --noEmit` passes (0 errors). `eslint .` fails 409 errors.
Majority noise from `dist/` build output (~300). Remaining ~100 in src/migrations: `no-explicit-any`, `no-unused-vars`, `prefer-const`, `no-unused-expressions`.
Goal: `lint` + `typecheck` green on CI. No new branch needed if fix landed? This spec makes green achievable on current or new branch.

Success: `npx eslint .` exit 0, `bunx tsc --noEmit` exit 0, `bun run build` still works.

## 2. Non-goals
- No new features
- No migration schema change
- No switch to biome/oxlint
- Not rewriting Kysely `any` payloads to full branded types beyond minimal

## 3. Scope

### 3.1 Diagnose
- Confirm tsc green (done)
- Categorize eslint errors: dist vs src vs migrations
- Identify config mismatch: `.eslintrc.json` legacy vs eslint v9 flat config (`eslint.config.mjs` expected, project has json legacy style)

### 3.2 Fix strategy (recommended: pragmatic)
Option A strict: fix every `any` -> unknown/Record. Large churn, risky for Kysely json columns.
Option B pragmatic (chosen): ignore build artifacts, relax noisy rules where idiomatic, fix real bugs.
Chosen B: low churn, green fast, no behavior change.

Changes:
- Ensure eslint ignores: `dist/`, `node_modules/`, `static/`, `migrations`? no keep migrations but maybe warn.
- Add `eslint.config.mjs` or `.eslintignore` / `ignores` if staying legacy: at minimum ignore `dist/`.
- Fix legacy config compat: eslint 10 requires flat config; translate .eslintrc.json to eslint.config.mjs or add `ESLINT_USE_FLAT_CONFIG=false` fallback not viable long term -> migrate to flat config.
- Rules adjustment:
  - `no-explicit-any`: keep error in src but allow `any` in `migrations/` via override, or downgrade to warn in Kysely json payload files (`src/db/db.ts`, `src/comfyui/*`, `src/api/*`) where `any` is Kysely json.
  - Alternative: replace `any` with `unknown` + narrow where easy (logger, queue-manager, comfyui-client function args).
  - `no-unused-vars`: allow `argsIgnorePattern: ^_` , `varsIgnorePattern: ^_` , `caughtErrorsIgnorePattern: ^_`
  - `prefer-const`: fix 4 occurrences (auto-fixable)
  - `no-unused-expressions`: appears mostly in `dist/` and 5 lines in comfyui-client (ternary with `&&`); fix source where present.
  - `no-empty-object-type`: fix `src/global.d.ts` interface.
- Fix real unused vars: remove or prefix `_` : `wan_t2v_*`, `comfyClient`, `Styles`, `VideoGenerator`, `sql`, `c`, `_context`, `db`, `error`, `allFiles`.
- Keep tsc `exclude: src/client` intentional? Verify Solid JSX still type-checked via vite. If tsc excludes client, lint must cover it.

### 3.3 Verification
- `bunx tsc --noEmit` 0
- `npx eslint .` 0
- `bun run build` / `vite build` passes
- No runtime change: start server, curl `/` 200

## 4. Architecture
- Single eslint config file: `eslint.config.mjs` (flat) exporting array with `ignores` + `typescript-eslint` recommended.
- No new deps. Use existing `eslint`, `typescript-eslint`, `globals`.
- CI runs `bunx tsc --noEmit && npx eslint .`

## 5. Risks
- Migrating config legacy->flat may hide rules if not translated correctly. Mitigate: run eslint before/after parity check on single file.
- Changing `any` to `unknown` may expose tsc errors where narrowing missing. Mitigate: only narrow trivial sites, otherwise eslint-disable comment with reason for Kysely json columns.

## 6. Alternatives considered
- Add `.eslintignore` dist only, keep legacy rc, keep 409 errors elsewhere: rejected still noisy.
- Fix all anys strictly: ~80 replacements, high risk, no value for migrations.

## 7. Open questions
- Keep `src/client` excluded from tsc? Probably keep but ensure Solid types checked via separate tsconfig or rely on vite-plugin-solid. Decision: leave exclude as is, document.
