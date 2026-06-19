# Render Bug Fix (Image Overlay) + AI Editor Tabs UI — Design+Plan

## Problem

### Bug: Image overlay missing from render
The `@keyframes` CSS animation (from previous task) runs on **wall-clock time**, not the virtualized GSAP timeline the HF producer seeks. The producer's `VIRTUAL_TIME_SHIM` overrides `Date.now()`/`performance.now()`/`requestAnimationFrame` but NOT CSS animations. Result: at capture time T, the CSS animation state is unpredictable → image not rendered.

### UI: Render result shows as row above 3 columns
`<div id="render-result" />` sits above the flex row in `HypercutWorkspace`. Render button is in the preview toolbar. No tabs in AI Editor column. Dismiss button on render result.

## Fix

### 1. Revert composition to GSAP `tl.fromTo` with position param
```js
tl.fromTo("#sugg-019edaa4",
  { scale: 0.3, rotation: -15, opacity: 0 },
  { scale: 0.6, rotation: 5, opacity: 1, duration: 1.19, ease: "power2.out" },
  1.5  // position — start at clip's data-start
);
```
Remove CSS `@keyframes` + inline `animation:` style. Remove initial `opacity:0; transform:...` from inline style (GSAP fromTo handles initial state). Accept `gsap_studio_edit_blocked` **warning** (it's about Studio drag-editability, not rendering — render works fine with GSAP tweens on registered timeline).

### 2. Remove autoFixLint GSAP-to-CSS conversion
The `fixGsapStudioEditBlocked` function in `agentic-editor.ts` and the system prompt rule 10 both promoted CSS `@keyframes` over GSAP tweens. This was wrong — CSS animations break deterministic rendering. Remove the conversion function. Update system prompt: GSAP tweens on registered timeline are REQUIRED for deterministic rendering. The `gsap_studio_edit_blocked` warning is informational only.

### 3. UI: Tabs in AI Editor column
Replace the current `AgentChat` component with a tabbed panel:
- **Chat tab**: current chat UI (messages, quick actions, input)
- **Render tab**: render button + render output area (video + download)

Remove `<div id="render-result" />` from `HypercutWorkspace`. Remove render button from preview toolbar. Remove dismiss button logic from `hypercut-workspace.js`.

### 4. Render flow with HTMX
- Render button: `hx-post="/api/jobs/hypercut/:job_id/render"` → `hx-target="#render-output"` → `hx-swap="innerHTML"`
- While rendering: button shows loading spinner via `hx-disabled-elt`
- API returns HTML fragment (not JSON): `<video>` + download button on success, error alert on failure
- No dismiss button

## File Changes

| File | Change |
|---|---|
| `src/templates/agent-chat.tsx` | Replace with tabbed panel (Chat + Render tabs) |
| `src/templates/hypercut.tsx` | Remove `render-result` div, remove render button from toolbar, keep regenerate + fullscreen |
| `src/api/api/hypercut.ts` | `render_job` returns HTML fragment instead of JSON |
| `static/js/hypercut-workspace.js` | Remove `initRender` (HTMX handles it), remove dismiss logic, remove render-result references |
| `src/hypercut/agentic-editor.ts` | Remove `fixGsapStudioEditBlocked`, remove system prompt rule 10's CSS recommendation |
| `src/hypercut/gsap-to-css.ts` | Keep (still useful as utility) but stop using it in autoFixLint |
| `src/hypercut/fix-composition-gsap-to-css.ts` | Replace with `fix-composition-gsap-position.ts` that adds position params to GSAP fromTo calls |
| Current composition on disk | Revert CSS @keyframes to GSAP fromTo with position=1.5 |

## Tasks

1. Fix composition on disk (revert CSS to GSAP with position)
2. Remove autoFixLint GSAP-to-CSS + update system prompt
3. Update `render_job` API to return HTML fragment
4. Rewrite `agent-chat.tsx` with tabs
5. Update `hypercut.tsx` (remove render-result, remove render button)
6. Update `hypercut-workspace.js` (remove render/dismiss logic)
7. Verify: lint, render, typecheck, tests
