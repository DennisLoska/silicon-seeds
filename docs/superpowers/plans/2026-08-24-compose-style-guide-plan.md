# Plan: Compose Style Guide

## Tasks

### Task 1: DB + Schema — add jobs.style_guide
- Files: `src/db/db.ts:17-33` DbSchema.jobs add `style_guide?: string | null`, `src/db/tables.ts:28` addColumn `style_guide` text nullable, add migration alter via `src/db/migrate.ts` or inline `DB.migrateStyleGuide()` called at startup or `createTables` alt path. Simplest: `src/db/db.ts` add ensureColumn helper + call on module init, plus update tables.ts for fresh DB.
- Accept: fresh DB has column, existing DB after start:hot has column, `select style_guide from jobs limit 1` succeeds.
- Effort: S

### Task 2: Backend — PostComposeSchema + compose_video + job creation
- Files: `src/api/schemas.ts:24-48` add `style_guide: z.string().max(2000).optional()` (trim, empty→undefined via transform), `src/api/api/compose-video.ts:8-47` destructure style_guide, sanitize, pass to create_job, include in response? No. Ensure zValidator still passes multipart.
- Accept: `curl -F script=... -F style_guide="ancient only..." ... /api/jobs/videos/compose` returns 200, job row has style_guide, without style_guide still 200, >2000 chars 400.
- Effort: S

### Task 3: Prompt pipeline — image_scene_prompts styleGuide injection
- Files: `src/prompts/prompt-generator.ts:405` add `styleGuide?: string` param, append to list_prompt: `Global Style Guide (apply to every scene):\n${styleGuide}` when truthy, `src/queue/queue-manager.ts:142-184` fetch job.style_guide and pass to image_scene_prompts(job...clipCount, style_guide), leave fallback undefined.
- Add temporary Logger.info for verification then remove before PR (per spec, use Logger but remove logs again).
- Accept: mocked LLM test shows prompt string contains styleGuide, queue-manager passes job column, stylistic coherence observable in generated scenes when feature used.
- Effort: S

### Task 4: Frontend — Style Guide card below Video Script
- Files: `src/templates/compose.tsx:108-133` restructure first column: wrap Video Script card + new Style Guide card in flex flex-col gap-4 container w-full xl:w-1/2 2xl:w-1/3, Video Script card as before, new card title "Style Guide" with Icons.Palette/Brush, textarea name="style_guide" placeholder, helper text, classes: textarea min-h-[180px] max-h-[320px] resize-y, card p-4, ensure form still posts multipart. Keep right column `src/templates/generation-settings-cards.tsx` untouched.
- Verify via chrome devtools screenshot + curl that field submits.
- Accept: GET /compose HTML contains name="style_guide", layout stacked, height fits 5-10 bullets, right column unchanged, form submits.
- Effort: M

### Task 5: Verify end-to-end + cleanup
- Run `bunx tsc --noEmit`, `bun start:hot` + curl POST with style_guide + check DB, `bun test` if any, lens via chrome devtools snapshot, remove Logger temp logs, ensure lint no leftover console.log.
- Effort: S

## Dependencies: 1 → 2 → 3 → 4 → 5 (1-3 can parallel but 2 depends on 1 schema, 3 depends on 2/1, 4 independent of 1-3 except form field name must match schema)
## Parallelizable: Task 4 can run parallel with 1-2-3 (frontend vs backend), join at Task 5.

## Effort total: ~2-3h

## Verification
- `bunx tsc --noEmit`
- `curl -F script="ancient pyramid story" -F style_guide="warm ochre palette, no modern items" -F image_model=...` → 200 + job check via `sqlite3 silicon-seeds.sqlite "select style_guide from jobs order by created_at desc limit 1;"`
- chrome devtools takeSnapshot/takeScreenshot at /compose
- manual count: left column 2 cards, right column cards unchanged
