# Design: Theme Persistence Fix

Date: 2026-08-24
Status: approved
Issue: dark/light theme resets to light (bumblebee) on page navigation/full reload

## Context

- `src/templates/layout.tsx:4` hardcodes `<html data-theme="bumblebee">` — every full page load resets theme
- `src/templates/app.tsx:15` ThemeToggle uses DaisyUI `theme-controller` checkbox `value="dracula"` but no JS persistence glue
- `rg localStorage|sessionStorage|cookie theme` => 0 matches — no persistence
- Navigation via `hx-get` + `hx-push-url` keeps html element (theme stays), but direct load / refresh / non-HTMX fallback via `Api.renderFragment` re-renders full Layout and loses theme
- `src/templates/app.css` lists themes: light (default), dark, dracula, bumblebee etc — toggle only knows dracula vs unchecked (bumblebee)
- User expects toggle to persist until explicit change

## Goals

- Theme survives full page loads, hard refresh, direct URL entry, HTMX navigation
- No FOUC (flash of light before dark)
- Respects `prefers-color-scheme` on first visit
- Works with existing DaisyUI theme-controller checkbox, no server changes
- Verified via chrome devtools MCP: toggle -> navigate -> reload -> theme stays

## Non-Goals

- Multi-theme selector (keep binary dracula <-> bumblebee)
- Server cookie sync (unneeded complexity for static theme)
- Per-user DB persistence

## Approaches Considered

### A. Inline blocking script + localStorage (recommended)
- Add small inline script in `<head>` BEFORE style.css that reads `localStorage.getItem('theme')` synchronously and sets `document.documentElement.dataset.theme` before paint. Fallback to `prefers-color-scheme` if no stored value.
- Enhance ThemeToggle checkbox to sync with localStorage on change, and sync checkbox state on DOMContentLoaded/htmx:load.
- Pros: no FOUC, zero server changes, 10 lines, matches DaisyUI theme-controller pattern but adds early restore
- Cons: JS required (acceptable; app already requires JS for HTMX)

### B. Cookie + server-rendered data-theme
- JS writes cookie on toggle, server reads cookie in Layout and renders correct data-theme.
- Pros: SSR correct, works without FOUC, JS-disabled fallback
- Cons: needs Hono middleware, cookie parsing, extra complexity, still needs JS for toggle

### C. CSS only via prefers-color-scheme
- Map light/dark to system preference only.
- Pros: no storage
- Cons: no user override persistence

**Decision: A** — minimal, FOUC-free, verified via devtools, no server changes.

## Design

### 1. Layout head script — theme-store.ts -> inline or static/theme.js

File: `static/theme.js` (or inline in Layout.tsx <head> before style.css)

Logic:
```js
(function() {
  const LS_KEY = 'theme';
  const LIGHT = 'bumblebee';
  const DARK = 'dracula';
  try {
    let theme = localStorage.getItem(LS_KEY);
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? DARK : LIGHT;
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch {}
})();
```

Must run synchronously before CSS loads (no defer). Place as first script in <head>.

Second deferred script handles toggle sync + checkbox state restoration:

```js
document.addEventListener('DOMContentLoaded', () => {
  const cb = document.querySelector('.theme-controller');
  const html = document.documentElement;
  const LS_KEY='theme', LIGHT='bumblebee', DARK='dracula';
  if (!cb) return;
  // restore checkbox state
  cb.checked = html.getAttribute('data-theme') === DARK;
  cb.addEventListener('change', () => {
    const next = cb.checked ? DARK : LIGHT;
    html.setAttribute('data-theme', next);
    try { localStorage.setItem(LS_KEY, next); } catch {}
  });
  // handle htmx page swaps (htmx replaces innerHTML but checkbox persists — still sync)
  document.body.addEventListener('htmx:afterSettle', () => {
    cb.checked = html.getAttribute('data-theme') === DARK;
  });
});
```

Merge into existing `static/handlers.js` or new `static/theme.js` with blocking part extracted inline.

### 2. Layout.tsx changes

- Remove hardcoded `data-theme="bumblebee"`? Keep as fallback but overridden by inline script before CSS. Keep for SSR fallback / no-JS.
- Insert inline blocking script as first <script> in <head> (no src, no defer).
- Include deferred theme sync script (either inline deferred or src="/static/theme.js").
- Ensure script loads before style.css? Script before style.css ensures FOUC prevention.

### 3. App.tsx

- No structural change required; checkbox keeps class `theme-controller` + value dracula for DaisyUI compat.
- Optionally ensure ThemeToggle id for test targeting.

### 4. Storage contract

- key: `theme`
- values: `dracula` | `bumblebee`
- default if missing: prefers-color-scheme dark -> dracula else bumblebee
- toggle persists immediately on change

## Edge Cases

- localStorage unavailable (private mode) -> catch and fallback to prefers-color-scheme
- FOUC: blocking script eliminates
- HTMX navigation: checkbox outside #job-content-container, survives swap; afterSettle sync keeps checked state consistent
- Hard refresh after toggle -> inline script restores same theme before paint
- New user first visit -> respects OS dark preference

## Verification

- chrome devtools mcp: set dark -> navigate via sidebar hx-get -> assert html[data-theme]=dracula -> reload -> assert still dracula -> toggle to light -> reload -> assert bumblebee -> navigate -> assert bumblebee
- manual curl: GET / still returns bumblebee fallback but JS overrides (expected)
- `bunx tsc --noEmit` passes, `bun run build:css` unaffected

## Alternatives Rejected

- Cookie SSR: overkill for client theme, adds server middleware for cosmetic preference
- DaisyUI theme-controller alone: doesn't early-restore; explains bug

## Files to Touch

- `src/templates/layout.tsx` — add scripts
- `static/theme.js` (new) or `static/handlers.js` — toggle sync logic
- Possibly `src/templates/app.tsx` — trivial id addition if needed
