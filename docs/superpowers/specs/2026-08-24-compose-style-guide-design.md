# Spec: Compose Style Guide Card + Backend style_guide

## Goal
Add Style Guide input to /compose so users can define cross-image stylistic coherence (consistent colors, palette, character, era, material) separate from style_preset. Extend backend POST /api/jobs/videos/compose to accept style_guide, persist on jobs row, feed into per-scene image prompt generation.

## Context
- Compose UI: `src/templates/compose.tsx:81` 3-column kanban form. First column currently single card "Video Script" (textarea name=script + file input). Right column: AIModelsCard, VideoSettingsCard, StylePresetCard, VoiceCard, Action (generation-settings-cards.tsx). Do NOT touch right column.
- Backend: `src/api/api/compose-video.ts:8` compose_video(PostCompose) validates via PostComposeSchema (`src/api/schemas.ts:24`), creates job via JobOrchestrator.create_job, then TextGenerator.create_text_event + AudioGenerator.schedule_audio. No style_guide today.
- Image prompt flow: `src/queue/queue-manager.ts:142` schedule_composition_images fetches TextPrompt event text → PromptGenerator.image_scene_prompts(text, clipCount) → for each scene txt_to_img_prompt(scene,1,style_preset) → ImageGenerator.schedule_image. Style preset applied inside styled_image_prompt via StylePresets. Need coherent style across all scenes injected at image_scene_prompts level + optionally txt_to_img_prompt.
- DB: jobs table `src/db/tables.ts:28` + `src/db/db.ts:17-33` DbSchema.jobs — style_preset exists, need style_guide text nullable.

## Requirements
- UI: Below Video Script card in first column, new card "Style Guide" with textarea name="style_guide", height fits 5-10 bullet points (min-h ~160-200px, flex-grow, resize-y, max-h constrain to avoid page overflow). Same card styling bg-base-100 shadow-xl, title + icon (Palette/Brush), placeholder examples: "e.g. warm muted palette, watercolor texture, ancient Egypt only - no modern items, consistent character ...", helper text "Defines stylistic coherence across all generated images. Applies in addition to Style Preset." Form still hx-post multipart/form-data. Right column unchanged.
- Backend: PostComposeSchema add optional style_guide: z.string().max(2000).trim optional. compose_video destructures style_guide, sanitizes (Utils.sanitizeInputText or trim, allow empty→undefined), passes to create_job as style_guide. Must not confuse with style_preset.
- DB: Add jobs.style_guide TEXT nullable (DbSchema + createTables). Migration path: existing DB already in silicon-seeds.sqlite — use ALTER TABLE ADD COLUMN IF NOT EXISTS equivalent (kysely addColumn ifNotExists or raw sql with try/catch). Create helper or one-off migration file, ensure bun start:hot doesn't recreate tables (createTables drops — only on demand). Prefer ALTER via db.schema.alterTable addColumn ifNotExists plus runtime fallback.
- Prompt pipeline: PromptGenerator.image_scene_prompts(text, amount, styleGuide?) third param optional string. If provided, append to list_prompt as "Global Style Guide (must apply to every scene, takes precedence for coherence): <styleGuide>" alongside existing instructions. Also optionally pass to txt_to_img_prompt? Chooses image_scene_prompts infusion only (simplest, scenes already coherent) — document decision. queue-manager.ts schedule_composition_images reads job.style_guide and passes to image_scene_prompts.
- Validation: style_guide optional, empty string → treated as undefined, not stored. Max 2000 chars, else 400 error via zod.
- No change to voice, models, fps etc.
- Verification via logger temporary + chrome devtools screenshot + curl POST test (check job row contains style_guide).

## Non-goals
- Do not modify style_preset logic or presets
- No change to AutoCut path
- No gallery handling change
- No new job workflow type
- Do not redesign whole compose layout (only add card, keep xl flex row/col behavior)

## Decisions
- Card height: flex-col first column wrapper: split Video Script card (flex-grow) + Style Guide card (h ~ 220-280px, min-h-[180px] textarea, resize-y). Keep outer first-column as flex flex-col gap-4 w-full xl:w-1/2 2xl:w-1/3. Video Script card remove resize-x? Keep as is but wrap two cards in flex-col container.
- Store style_guide on jobs, not events — single source per compose job, read at schedule_composition_images.
- Prompt injection point: image_scene_prompts third arg, not styled_image_prompt, to keep preset lora orthogonal. If later need per-image lora combine, can add but out of scope.
- DB migration: addColumn ifNotExists plus fallback `sql` try (sqlite no ifNotExists on alter? kysely supports). Test on existing sqlite.
- Sanitization: same as script: Utils.sanitizeInputText if available else trim + slice 2000.

## Approaches considered
1. **Image_scene_prompts injection (chosen)** — simplest, one LLM call for all scenes includes global guide, coherence by design. Trade: less per-image lora but sufficient.
2. Per-image txt_to_img_prompt guide appended — more tokens per scene, stronger but duplicates cost (clipCount times). Could combine both but minimal gain.
3. Separate DB table for style metadata — overkill for single string.

## Success criteria
- GET /compose shows two stacked cards in left column: Video Script on top, Style Guide below, textarea fits 5-10 bullets, scrollable, form posts style_guide.
- POST /api/jobs/videos/compose with script + style_guide + other fields creates job with style_guide persisted (DB.Jobs.findById returns it).
- Prompt generation path logs style_guide when present and list_prompt contains it; verified via temporary Logger.info (remove before PR).
- Without style_guide still works (backward compat).
- Right column cards unchanged.
- bunx tsc --noEmit passes, bun start:hot loads, chrome devtools screenshot shows layout not broken.

## Risks
- SQLite alter on existing DB fails if column exists — handle catch.
- Kysely generated schema mismatch if column not added before insert — ensure schema interface updated first.
- Long style_guide bloats LLM prompt — cap 2000 chars.
