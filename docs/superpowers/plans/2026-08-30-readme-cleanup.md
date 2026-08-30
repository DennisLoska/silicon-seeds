# Readme Cleanup + Pixel Art Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply 8 README edits + regenerate hero.png with pixel art lora, no emdashes, no HTMX, correct section order.

**Architecture:** Single README.md edit + binary asset regeneration via ComfyUI Z-Image-Turbo pipeline. No code changes. Verification via rg checks.

**Tech Stack:** Markdown, ComfyUI API (127.0.0.1:8188), Z-Image-Turbo + pixel_art_style_z_image_turbo lora, Bun.

---

### Task 1: Regenerate hero.png with pixel art lora

**Files:**
- Modify: `readme/hero.png` (binary, 1536x864)
- Read: `src/comfyui/workflows/image_z_image_turbo_lora_720p.json` for workflow template

- [ ] **Step 1: Verify ComfyUI reachable and lora exists**
Run: `curl -s http://127.0.0.1:8188/system_stats | head`
Run: `ls -lh /run/media/dennis/ai/comfy-ui/models/loras/pixel_art_style_z_image_turbo.safetensors`
Expected: both exist, system_stats returns JSON

- [ ] **Step 2: Generate pixel art hero via ComfyUI**
Use existing generate-comfy-image skill logic or direct ComfyUI API. Prompt: "silicon wafer sprouting seedlings, techno-organic fusion, pixel art, 8-bit, detailed pixel art landscape, vibrant colors" + pixel art lora strength 1.0, 9 steps, 1536x864.
Workflow: clone image_z_image_turbo_lora_720p.json, set width 1536 height 864, lora pixel_art_style_z_image_turbo strength 1.0, steps 9, cfg 1.0, seed random.
Run via `bun` script or `curl /prompt` then poll `/history` and copy from OUTPUT_DIR to readme/hero.png.
Expected: new hero.png overwritten, file >100KB, timestamp updated.

- [ ] **Step 3: Verify hero**
Run: `ls -lh readme/hero.png; file readme/hero.png`
Expected: PNG, ~1-2MB, 1536x864

- [ ] **Step 4: Commit hero**
```bash
git add readme/hero.png
git commit -m "assets: regenerate hero.png with pixel art lora"
```

### Task 2: Edit README.md to satisfy all 8 requirements

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current README.md**
Run: `cat README.md` (verify 245 lines)
Expected: file exists

- [ ] **Step 2: Apply edits**
Edits to apply in one pass:
1. Remove HTMX: delete badge `HTMX+SSE+WebSockets` line, replace Frontend row "HTMX-style SSE" with "SSE".
2. Remove line `> Hero banner generated locally with Z-Image-Turbo ...`
3. Add links in Prerequisites: ComfyUI -> https://github.com/comfyanonymous/ComfyUI, Voicebox -> https://github.com/JarodMica/voicebox, LM Studio -> https://lmstudio.ai. Also link in Service dependencies table if present.
4. Remove all `—` emdashes, replace with `-` or `,`.
5. Move Quick Start section below Showcase (Showcase → Quick Start → Features → Architecture → Prerequisites → Services → Env → First run → Tech Stack → Troubleshooting).
6. Delete `## 🗂️ Project layout` entire section.
7. Delete two troubleshooting bullets (Queue stuck at audio, Styles not appearing).
8. Ensure library.png reference retained, gallery.png untouched.
9. Update nav anchor order to match new section order.
10. Verify no new emdash introduced.

- [ ] **Step 3: Verify edits**
Run:
```
rg "—" README.md && echo "FAIL emdash present" || echo "PASS no emdash"
rg -i "htmx" README.md && echo "FAIL htmx" || echo "PASS no htmx"
grep -c "Project layout" README.md
grep -c "Hero banner generated" README.md
grep -c "Queue stuck at audio" README.md
grep -c "Styles not appearing" README.md
```
Expected: 0 for all forbidden strings, no emdash.

- [ ] **Step 4: Verify section order**
Run: `grep -n "^## " README.md`
Expected: Showcase (line ~30) → Quick Start → Features → Architecture → Prerequisites → Service dependencies → Environment → First run → Tech Stack → Troubleshooting → License

- [ ] **Step 5: Typecheck**
Run: `bunx tsc --noEmit`
Expected: PASS (no code changed)

- [ ] **Step 6: Commit**
```bash
git add README.md
git commit -m "docs(readme): cleanup htmx, emdashes, reorder, links, remove sections + hero pixel art"
```

### Task 3: Final verification + push + PR prep

**Files:**
- None (verification only)

- [ ] **Step 1: Run verification checks**
Run: `bunx tsc --noEmit; rg "—" README.md; rg -i "htmx" README.md; ls -lh readme/hero.png`
Expected: all PASS

- [ ] **Step 2: Push branch**
Run: `git push -u origin fix/readme-cleanup`
Expected: pushed
