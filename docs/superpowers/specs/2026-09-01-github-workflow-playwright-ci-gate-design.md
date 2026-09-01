# Spec: GitHub Workflow — Playwright E2E Gate on Master

Date: 2026-09-01
Status: draft
Topic: github-workflow-playwright-ci-gate

## Purpose
Enforce that Playwright E2E tests must pass in CI before any merge to `master` can land. Add a GitHub Actions workflow that runs `bunx playwright test` on PRs targeting `master` (and optionally pushes to `master`), and make that job a required status check. Protects `master` from regressions without manual discipline.

## Context
- No `.github/` dir currently exists. No workflows present.
- Playwright configured in `playwright.config.ts`: `testDir: e2e`, `webServer: bun run build && bun src/main.ts`, Chromium only, 8 specs across 7 pages (compose, create-image, create-video, create-audio, gallery, jobs, settings) plus helpers, headless.
- Scripts: `test:e2e` = `playwright test`, `build` = `vite build`, `prestart` = `tsc --noEmit`.
- Runtime: Bun >=1.3 (`package.json`), app runs via `bun src/main.ts` (Hono + SolidJS). E2E `webServer` expects `bun`.
- Current branch `master` tracking `origin/master`. No branch protection active via API yet (to verify with `gh api`).
- User intent: "when we want to merge on master first the playwright e2e tests have to pass in the ci"

## Goals
- `.github/workflows/ci.yml` triggers on `pull_request` to `master` (and optionally `push` to `master`) and runs Playwright E2E headless.
- Workflow is green/red correctly: install Bun, install deps (`bun install`), install Playwright browsers (`bunx playwright install --with-deps chromium`), then `bunx playwright test` (or `bun run test:e2e`) with `CI=true`.
- Artifact upload on failure: `playwright-report` / `test-results`.
- `master` merge blocked unless workflow job passes (required status check). Either via workflow alone (status check exists) + manual repo setting, or automated via `gh api` if token permits.
- Fast, deterministic CI: cache Bun/node_modules, timeout ~15 min, concurrency cancel old runs.

## Non-goals
- Full matrix (multiple browsers/OS). Chromium only for now.
- Unit / non-Playwright tests.
- Auto-fixing flaky E2E or adding new coverage.
- Rewriting history or branch protection model beyond one required check.

## Approach Options

### Option 1: Minimal PR workflow (recommended)
- File: `.github/workflows/ci.yml`
- Triggers: `pull_request: branches: [master]` + `push: branches: [master]` (push ensures master not broken by direct pushes if protection bypass).
- Job `e2e` on `ubuntu-latest`: checkout, `oven-sh/setup-bun`, `bun install --frozen-lockfile`, `bunx playwright install --with-deps chromium`, `bun run build`, run `bunx playwright test` (rely on config webServer, or start manually).
- Permissions: `contents: read`
- Concurrency: `group: ci-${{ github.ref }}` cancel-in-progress.
- User then enables branch protection: Settings > Branches > Add rule for `master` > Require status checks to pass > select `e2e`.

Pros: simplest, one file, no repo API mutation, user does one-click enable. Cons: workflow alone does not block merge until protection enabled (doc it).

### Option 2: Workflow + auto branch protection via `gh api`
- Same workflow as Option 1 plus a one-time setup step (script or workflow that calls `gh api -X PUT /repos/{owner}/{repo}/branches/master/protection` with `required_status_checks.contexts: ["e2e"]`).
- Pros: fully automated gate. Cons: needs admin token scope, fragile if repo permissions missing, side-effectful.

### Option 3: Reusable workflow + job matrix + required workflows
- Extract `e2e.yml` reusable workflow and call from `ci.yml`, add `pull_request_target` variant, matrix for future browsers.
- Pros: extensible. Cons: overkill for single required job today; harder to reason.

**Recommendation:** Option 1. One workflow file, documented manual step to make check required. Attempt Option 2 automation ad-hoc if `gh` auth allows, but do not fail if not.

## Design

### Workflow file `.github/workflows/ci.yml`
```yaml
name: CI
on:
  pull_request:
    branches: [master]
  push:
    branches: [master]
permissions:
  contents: read
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with: { bun-version: latest }
      - run: bun install --frozen-lockfile
      - run: bunx playwright install --with-deps chromium
      - run: bunx playwright test
        env: { CI: true }
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

Consider caching: `setup-bun` handles cache, or keep simple without explicit cache action. `webServer` in `playwright.config.ts` already does `bun run build && bun src/main.ts`, so no separate build step required, but explicit `bun run build` can be kept to fail fast.

Alternative env: `PLAYWRIGHT_BASE_URL` left default; webServer url `http://localhost:3000`.

Node version not needed; Bun provides node compat. Use `ubuntu-latest`.

### Branch protection (required status check)
- After workflow is on `master` (or at least on PR branch), GitHub creates check named `e2e` (or `CI / e2e` depending on name). Protection rule must reference exact context string.
- Verify context string from workflow run logs / Checks API.
- Manual path: repo Settings -> Branches -> Branch protection rule -> Branch name pattern `master` -> Require status checks to pass before merging -> Search `e2e` -> Require branches to be up to date -> Include administrators optionally.
- CLI path (best-effort): `gh api repos/:owner/:repo/branches/master/protection -X PUT ...` with `required_status_checks: { strict: true, contexts: ["e2e"] }` plus `enforce_admins: false`. Try, log result, do not block workflow creation if fails.

### Testing / verification
- `actionlint` or `yaml` lint if available.
- Local dry: `bunx playwright test` already passes? Run headless locally.
- Push branch, open PR to master, check Checks tab shows workflow running.
- After protection enabled, try to merge with failing check blocked.

### Error handling
- If `bun install` fails due to lockfile drift, CI surfaces error.
- If no `.github/workflows/ci.yml` present, push protection script should error clearly.

### Risks
- Check name mismatch between workflow job name and protection `contexts` -> protection never satisfied. Mitigate by keeping job name `e2e` and documenting exact string.
- Direct pushes to master bypass PR gate unless protection covers `push`. Workflow triggers on push catches but protection is PR-only. Recommend enable "Require pull request reviews" optionally but not required per spec.

## Decisions
- Workflow job name `e2e` (lowercase) — matches simple context. If display name `CI / e2e` needed, handle that.
- Chromium only (matches `playwright.config.ts` projects).
- `setup-bun@v2` preferred per Bun docs.

## Open Questions (resolve before plan)
- Should `push` to master also run CI? Yes for post-merge sanity, but not strictly required for gate. Include it.
- Strict mode for protection? Recommend `strict: true` so branch must be up to date.

## Success criteria
- File `.github/workflows/ci.yml` exists and is valid YAML.
- On PR to master, `e2e` job appears and must pass before GitHub allows merge (once protection set).
- CI installs deps, browsers, runs 8 tests, uploads report on failure, cancels superseded runs.
- Documented step to enable required check; attempt CLI enable and record outcome.

## Out of scope future work
- Multiple browsers/OS matrix
- Coverage upload, Codecov, lint/typecheck gates
- Auto-merge bots
