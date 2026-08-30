# Spec: README cleanup + hero pixel art regeneration

Date: 2026-08-30
Branch: fix/readme-cleanup
Status: approved

## 1. Problem & Goal

README outdated after SolidJS rewrite: still mentions HTMX, contains stale sections (project layout), emdashes forbidden, order wrong (quick start before showcase), troubleshooting has two entries to remove, hero banner needs pixel art variant, requirements need upstream links, showcase gallery must use user's library.png not auto-generated gallery.

Goal: branch fix/readme-cleanup, edit README.md to match 8 explicit user edits, regenerate hero.png via Z-Image-Turbo + pixel_art_style_z_image_turbo lora on local RTX 5090.

## 2. Non-goals

- No code changes beyond README + readme/hero.png
- No new screenshots capture (use existing readme/*.png, keep user's library.png)
- No HTMX reintroduction, no architecture mermaid changes unless emdash cleanup

## 3. Requirements

### 3.1 Remove HTMX references
- Remove badge `HTMX+SSE+WebSockets`
- Remove Frontend row mention "HTMX-style SSE"
- Any other "HTMX" string in README must be removed or replaced with SolidJS/SSE/WS accurate description.

### 3.2 Regenerate hero (first image)
- Input: readme/hero.png (1536x864) currently Z-Image-Turbo techno-organic.
- Output: new hero.png 1536x864 regenerated with same base pipeline (z_image_turbo_bf16.safetensors + qwen_3_4b CLIP, 9 steps) plus pixel_art_style_z_image_turbo.safetensors lora stacked (strength 0.8-1.0). Prompt: silicon wafer sprouting seedlings, techno-organic fusion, pixel art style. Keep dimensions, verify file exists >100KB.

### 3.3 Use library screenshot, not yours
- Showcase table already references gallery.png + library.png note. Keep library.png as user's screenshot. Do not replace library.png or gallery.png with new capture. Ensure README references library.png as retained history, not overwritten.

### 3.4 Remove hero generation caption
- Delete line: `> Hero banner generated locally with Z-Image-Turbo (...) on RTX 5090 — same pipeline the app uses.` (including emdash variant)

### 3.5 Requirements section links
- In Prerequisites / Service dependencies, link to official homepages: ComfyUI (https://github.com/comfyanonymous/ComfyUI), Voicebox (https://github.com/JarodMica/voicebox or official), LM Studio (https://lmstudio.ai/). Verify links.

### 3.6 Remove emdashes
- Delete every `—` (U+2014) from README.md. Replace with hyphen `-` or comma or period where needed. `rg "—"` must return 0 hits.

### 3.7 Move quick start below showcase
- Order: Showcase → Features → Architecture → Prerequisites → Service dependencies → Environment variables → Quick Start → First run → Tech Stack → Troubleshooting → License. Currently Quick Start is above First run but after Env. Requirement: move Quick Start section to below Showcase section. Interpretation: Showcase should be first after intro, then Quick Start. Implement as: Showcase → Quick Start → Features → Architecture → ... OR exactly "below showcase" means directly after Showcase block. Choose: Showcase → Quick Start → Features → Architecture → Prerequisites → ... Keep navigation anchor order consistent.

### 3.8 Remove project layout
- Delete entire `## 🗂️ Project layout` section (code fence + file tree).

### 3.9 Remove two troubleshooting entries
- Delete bullet: `Queue stuck at audio → audio is single-threaded ...`
- Delete bullet: `Styles not appearing → POST /api/style-presets requires DB; ...`
- Keep other 4 bullets.

## 4. Architecture

- Single file edit: README.md
- One binary asset regen: readme/hero.png via comfyui local API (ComfyUI at 127.0.0.1:8188) using existing workflow image_z_image_turbo_lora_720p.json pattern with lora chain.
- No DB migrations, no code.

## 5. Data Flow

N/A. Documentation only.

## 6. Error Handling

- If ComfyUI unreachable, fail hero regen with clear error, do not commit partial README.
- If lora not found, abort.
- Verify no emdash remains post-edit.

## 7. Testing

- `rg "—" README.md` → 0 hits
- `rg -i "htmx" README.md` → 0 hits
- `grep -c "Project layout" README.md` → 0
- `grep -c "Queue stuck at audio" README.md` → 0
- `grep -c "Styles not appearing" README.md` → 0
- `grep -c "Hero banner generated" README.md` → 0
- `ls -lh readme/hero.png` exists, new timestamp, >100KB
- `bunx tsc --noEmit` still passes (no code change)
- Visual check via `cat README.md | head -n 50`

## 8. Risks

- Hero regen may produce different aspect if workflow misconfigured. Mitigate: explicitly set width 1536 height 864.
- Emdash in shields URL `GPL--3.0` is double hyphen not emdash, keep.

## 9. Acceptance Criteria

All 8 bullet requirements satisfied, branch pushed, PR ready.

