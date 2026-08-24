# Theme Persistence Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Theme toggle persists across full page loads, hard refresh, and HTMX navigation until explicitly changed

**Architecture:** Inline blocking script in Layout head reads localStorage before paint to set data-theme (prevents FOUC). Deferred sync script restores checkbox state and persists on change + handles htmx:afterSettle. Single source of truth: localStorage key `theme` with values `dracula`/`bumblebee`.

**Tech Stack:** Hono JSX SSR, DaisyUI theme-controller, vanilla JS, localStorage, HTMX

---

### Task 1: Create theme persistence scripts

**Files:**
- Create: `static/theme.js`
- Modify: `src/templates/layout.tsx:1-20`
- Test: manual chrome devtools verification (no test suite exists per package.json)

#### File structure
- `static/theme.js` — deferred sync logic (checkbox <-> data-theme <-> localStorage)
- `src/templates/layout.tsx` — inline blocking early-restore script + include theme.js defer

- [ ] **Step 1: Create static/theme.js**

Create `static/theme.js` with:
```js
(function () {
  const LS_KEY = "theme";
  const LIGHT = "bumblebee";
  const DARK = "dracula";
  function sync() {
    const cb = document.querySelector(".theme-controller");
    const html = document.documentElement;
    if (!cb) return;
    cb.checked = html.getAttribute("data-theme") === DARK;
    // avoid duplicate listeners on htmx re-settle
    if (cb.dataset.themeBound) return;
    cb.dataset.themeBound = "1";
    cb.addEventListener("change", () => {
      const next = cb.checked ? DARK : LIGHT;
      html.setAttribute("data-theme", next);
      try { localStorage.setItem(LS_KEY, next); } catch {}
    });
  }
  document.addEventListener("DOMContentLoaded", sync);
  document.body.addEventListener("htmx:afterSettle", sync);
  // htmx 2.x also fires htmx:load
  document.body.addEventListener("htmx:load", sync);
})();
```

- [ ] **Step 2: Modify src/templates/layout.tsx to add early-restore inline script + theme.js include**

Current file:
```tsx
export const Layout = ({ children }: { children: Child }) => (
  <html lang="en" data-theme="bumblebee">
    <head> ... <script defer src="/static/handlers.js"></script> </head>
```

Change to:
```tsx
export const Layout = ({ children }: { children: Child }) => (
  <html lang="en" data-theme="bumblebee">
    <head>
      <script>{`(function(){try{var k="theme",l="bumblebee",d="dracula",t=localStorage.getItem(k);if(!t)t=window.matchMedia("(prefers-color-scheme: dark)").matches?d:l;document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`}</script>
      <meta charset="UTF-8" />
      ...
      <script defer src="/static/handlers.js"></script>
      <script defer src="/static/theme.js"></script>
    </head>
```

Requirements:
- Inline script MUST be first child of <head> before <meta> or style link to prevent FOUC
- Script has no defer, runs synchronously
- Fallback to matchMedia if no LS value
- Use minified-safe inline to avoid JSX escaping issues; use dangerouslySetInnerHTML or direct string child inside <script>
- Keep fallback data-theme="bumblebee" on html for no-JS case

Note for JSX: Hono JSX requires passing script content as children string. Verify with: `bunx tsc --noEmit` passes.

- [ ] **Step 3: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 4: Verify static file served**

Run: `bun src/main.ts &` then `curl -s http://localhost:3000/ | head -20` and `curl -s http://localhost:3000/static/theme.js | head -20`
Expected: HTML contains inline theme script before meta, and theme.js returns JS

- [ ] **Step 5: Commit**

```bash
git add -f src/templates/layout.tsx static/theme.js docs/superpowers/plans/2026-08-24-theme-persistence.md
git commit -m "feat: persist theme across page loads"
```

---

### Task 2: Verify with chrome devtools MCP

**Files:**
- No new files — verification task

- [ ] **Step 1: Start server hot**

Run: `bun --hot src/main.ts` or `bun start:hot` in background, ensure port 3000

- [ ] **Step 2: Chrome devtools checks**

Using chrome-devtools MCP:
1. Navigate to http://localhost:3000/
2. Read initial html data-theme
3. Click ThemeToggle checkbox (swap), assert html data-theme becomes dracula
4. Verify localStorage.getItem('theme') === 'dracula'
5. Click sidebar link to /dashboard via hx-get (or navigate to /dashboard), assert data-theme still dracula without reload
6. Reload page (chrome-devtools_navigate_page reload), assert data-theme still dracula and checkbox checked
7. Toggle back to light (uncheck), assert data-theme bumblebee
8. Navigate to /settings, /gallery, /jobs — assert stays bumblebee
9. Reload again, assert bumblebee persists
10. Test prefers-color-scheme fallback: clear localStorage, reload, check theme matches OS preference (optional)

Capture screenshots or snapshot snapshots for evidence.

- [ ] **Step 3: Fix any failures**

If checkbox state not restored after htmx navigation, add explicit htmx:afterSettle listener verification.
If FOUC still visible, ensure inline script is before style.css link.

- [ ] **Step 4: Run lint/typecheck**

Run: `bunx tsc --noEmit` and `bun run lint`
Expected: PASS
