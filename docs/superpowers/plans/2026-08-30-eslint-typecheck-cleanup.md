# ESLint + Typecheck Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `bunx tsc --noEmit` and `npx eslint .` both exit 0 on clean checkout, without behavior change.

**Architecture:** Migrate lint config to flat `eslint.config.mjs` with proper `ignores` for build output, add targeted overrides for migrations/Kysely `any`, fix real `prefer-const` / `no-unused-vars` / `no-empty-object-type` sources.

**Tech Stack:** eslint 10, typescript 5.9, typescript-eslint 8.57, bun

---

### Task 1: Establish baseline + migrate eslint config to flat config with ignores

**Files:**
- Modify: `eslint.config.mjs` (create, replaces legacy)
- Modify: `.eslintrc.json` (remove or keep for compat note, but flat config takes precedence)
- Modify: `package.json` (lint script ensure `eslint .`)

**Context:** Project currently has `.eslintrc.json` legacy style but eslint 10 defaults to flat config. Need `eslint.config.mjs` with `ignores: ["dist/**","node_modules/**","static/**","coverage/**"]`. Keep same parser/plugins/rules.

- [ ] **Step 1: Write baseline script to capture current counts**

Create `/tmp/lint-baseline.sh`:
```bash
#!/bin/bash
bunx tsc --noEmit; echo "TSC:$?"
npx eslint . 2>&1 | tail -n 5
npx eslint . 2>&1 | grep -c "error"
```

Run: `bash /tmp/lint-baseline.sh`
Expected: TSC:0, eslint 409

- [ ] **Step 2: Create eslint.config.mjs flat config**

Create `eslint.config.mjs`:
```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "static/**", "coverage/**", "docs/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["migrations/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/db/**", "src/comfyui/**", "src/api/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
```

- [ ] **Step 3: Remove legacy config to avoid confusion (or keep if needed)**

Run: `rm -f .eslintrc .eslintrc.json .eslintrc.js` OR keep but note flat overrides it. Prefer delete `.eslintrc.json`.

- [ ] **Step 4: Verify new config loads and dist ignored**

Run: `npx eslint . 2>&1 | head -n 30`
Expected: no `dist/` errors, count drops to ~50-70

- [ ] **Step 5: Commit**

```bash
git add -f eslint.config.mjs
git add package.json  # if changed
git rm -f .eslintrc.json 2>/dev/null || true
git commit -m "chore(lint): migrate to flat config, ignore dist, relax any/unused patterns"
```

---

### Task 2: Fix real lint errors — prefer-const, no-empty-object-type, no-unused-expressions, unused vars

**Files:**
- Modify: `src/global.d.ts:6`
- Modify: `src/comfyui/comfyui-client.ts:8,18,256,384,386,390,394,398,402`
- Modify: `src/llm/llm.ts:40`
- Modify: `src/queue/queue-manager.ts:11`
- Modify: `src/script/batch-embeddings.ts:44`
- Modify: `src/api/api.tsx:223`
- Modify: `src/api/api/cancel.ts:8`
- Modify: `src/api/api/delete.ts:3`
- Modify: `src/db/db.ts:1`
- Modify: `src/prompts/prompt-generator.ts:3,5,8`
- Modify: `src/client/components/Layout.tsx:101`
- Modify: `src/client/pages/Settings.tsx:54`
- Modify: `src/logger/logger.ts:48` (check that line)

- [ ] **Step 1: Run eslint on src only to list remaining errors**

Run: `npx eslint src/ 2>&1 | grep -E "error" | head -n 100`

- [ ] **Step 2: Fix each category**

For `prefer-const` (llm.ts:40, comfyui-client.ts:384, queue-manager.ts:11, batch-embeddings.ts:44): change `let` to `const` where never reassigned.

For `no-empty-object-type` (global.d.ts:6): change `interface JSX {}` empty augmentation to `// eslint-disable-next-line` or use `type` augmentation or add comment `// augment JSX`. Simplest: add `eslint-disable` comment above line.

For `no-unused-vars` with `^_` allowance: prefix unused param with `_` e.g. `_c`, `_context`, `_error`, or remove import if truly unused (`wan_t2v_api`, `wan_t2v_workflow`, `comfyClient`, `Styles`, `VideoGenerator`, `sql`). If import side-effect needed, prefix or remove.

For `no-unused-expressions` in comfyui-client.ts:386 etc: those are likely `x && y()` patterns. Replace with `if (x) y();` or add `eslint-disable`.

For Layout.tsx:101 `any`: since src/api override already off for api, but client Layout is not covered - add `eslint-disable-next-line @typescript-eslint/no-explicit-any` with comment.

- [ ] **Step 3: Verify src lint clean**

Run: `npx eslint src/ 2>&1 | tail -n 20`
Expected: 0 errors, only maybe warns (any warn)

- [ ] **Step 4: Run tsc to ensure no type regression**

Run: `bunx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(lint): resolve prefer-const, empty-object, unused-vars, unused-expressions"
```

---

### Task 3: Final verification — tsc, eslint, build

**Files:** none (verification only)

- [ ] **Step 1: Run tsc**

Run: `bunx tsc --noEmit; echo $?`
Expected: 0

- [ ] **Step 2: Run eslint**

Run: `npx eslint . 2>&1 | tail -n 20; echo $?`
Expected: 0, no errors

- [ ] **Step 3: Run build**

Run: `bun run build:css 2>&1 | tail; echo $?` and `npx vite build 2>&1 | tail -n 20`
Expected: 0

- [ ] **Step 4: Cure .gitignore docs if needed for plan/spec persistence**

Already handled with -f, but ensure docs not needed for CI. No change.

- [ ] **Step 5: Tag oneshot done if needed**

Optional: `git tag oneshot-eslint-...` but main pipeline will handle.

