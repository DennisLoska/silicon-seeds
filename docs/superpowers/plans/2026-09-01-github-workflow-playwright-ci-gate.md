# GitHub Workflow Playwright CI Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.github/workflows/ci.yml` so every PR targeting `master` must pass Playwright E2E (Chromium) before merging, with artifacts on failure and concurrency control.

**Architecture:** Single workflow file with `pull_request` + `push` triggers on `master`, job `e2e` on `ubuntu-latest` using `oven-sh/setup-bun`, `bun install`, `playwright install --with-deps chromium`, `bunx playwright test`. Branch protection references job name `e2e` as required check.

**Tech Stack:** GitHub Actions, Bun, Playwright Test, Ubuntu latest, actions/checkout@v4, oven-sh/setup-bun@v2, actions/upload-artifact@v4

---

## File Structure

- Create: `.github/workflows/ci.yml` — CI workflow (single job `e2e`)
- No modify of existing code; `playwright.config.ts`, `e2e/*.spec.ts`, `package.json` stay as-is.
- Verify: workflow YAML valid, local `bunx playwright test` passes, CI run green, branch protection set.

---

### Task 1: Create GitHub Actions workflow for Playwright E2E gate

**Files:**
- Create: `.github/workflows/ci.yml`
- Test: validate via `bunx playwright test` locally and `actionlint` / YAML parse check; plus trigger simulation

- [ ] **Step 1: Create workflow directory and file**

Run:
```bash
mkdir -p .github/workflows
```

Create `.github/workflows/ci.yml` with content:
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
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Install Playwright browsers
        run: bunx playwright install --with-deps chromium

      - name: Run Playwright E2E tests
        run: bunx playwright test
        env:
          CI: true

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

      - name: Upload test results on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
          retention-days: 7
```

Notes:
- Uses `bun install --frozen-lockfile` to respect `bun.lock`.
- Relies on `playwright.config.ts` webServer (`bun run build && bun src/main.ts`) — no separate build step needed, but keeps CI faithful to local `test:e2e`.
- Job name `e2e` will appear as `CI / e2e` or `e2e` in Checks; document exact string for protection rule.

- [ ] **Step 2: Validate YAML and workflow syntax locally**

Run:
```bash
bun -e "import {readFileSync} from 'fs'; import {parse} from 'yaml' // or simple JSON: use js-yaml if present"
# fallback simple:
cat .github/workflows/ci.yml
python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "YAML valid"
# or if python yaml missing:
bun -e "const fs=require('fs'); const c=fs.readFileSync('.github/workflows/ci.yml','utf8'); if(!c.includes('pull_request')) throw new Error('missing trigger'); console.log('basic check pass')"
```

Expected: YAML parses, file contains `pull_request:`, `push:`, `branches: [master]`, `e2e:`.

Also run if `actionlint` available:
```bash
actionlint .github/workflows/ci.yml 2>&1 || echo "actionlint not installed — skip"
```

- [ ] **Step 3: Dry-run Playwright locally to ensure CI command matches**

Run:
```bash
bunx playwright test --list
# or
bunx playwright test
```

Expected: lists 8 tests (or runs pass). Must not require generate/upload. Config uses `http://localhost:3000` and starts server via webServer. If local run needs `bun run build` first, workflow's reliance on webServer already covers it.

If tests need building, verify `bun run build` succeeds:
```bash
bun run build
```

- [ ] **Step 4: Commit workflow**

Run:
```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub workflow gating master on Playwright E2E (chromium)"
```

- [ ] **Step 5: Verify branch protection setup (manual + attempted automation)**

Check current protection:
```bash
gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches/master/protection 2>&1 | head -n 100
# or
gh api repos/DennisLoska/silicon-seeds/branches/master/protection
```

Attempt to set required status check (best-effort; do not fail plan if unauthorized):
```bash
# Determine owner/repo
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
gh api -X PUT repos/$REPO/branches/master/protection \
  -f required_status_checks[strict]=true \
  -f required_status_checks[contexts][]=e2e \
  -f enforce_admins=false \
  -f required_pull_request_reviews=null \
  -f restrictions=null \
  2>&1 | head -n 50
```

If contexts mismatch (`CI / e2e` vs `e2e`), adjust: try `gh api repos/$REPO/commits/master/check-suites` after first run, or check `gh api repos/$REPO/commits/master/status` to discover exact context. Update protection accordingly or document manual step.

Document manual fallback in README or spec if API fails: Settings > Branches > Branch protection rule > master > Require status checks to pass > select `e2e`.

- [ ] **Step 6: End-to-end verification of gate**

1. Push branch `feat/ci-gate` with workflow.
2. Open PR to `master` (via `gh pr create` or manually). Observe Checks tab: `CI` workflow running, job `e2e` appears.
3. After green, verify merge button blocked until check passes (if protection already set); if not set, set it and re-verify.
4. Optionally test negative: push a branch with intentionally failing spec change, confirm PR blocked.

Expected: PR cannot merge without `e2e` passing when protection enabled.


## Self-Review

- Spec coverage: workflow triggers (pull_request + push on master) -> Task 1 Step 1. Bun + Playwright install + run -> Step 1. Artifacts on failure -> Step 1. Concurrency -> Step 1. Branch protection gate -> Step 5. Verification -> Step 6. All spec goals covered.
- Placeholder scan: no TBD/TODO; all file paths exact, all commands exact, YAML fully specified.
- Type consistency: job name `e2e` consistent across workflow and protection contexts.

## Execution Handoff

Plan complete. Use subagent-driven-development for implementation: dispatch one subagent for Task 1 (workflow creation + validation). No parallel tasks needed; single file change.
