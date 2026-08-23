# Plan: Content Library Consolidation → ~/content_library

## Tasks

### Task 1: Create target dirs + migrate files
- Files: create `/home/dennis/content_library/{image,video,text,chroma-data}`
- Move `content/image/*` (incl hidden `.*.metadata.json`) → `~/content_library/image/`
- Move `content/video/*` → `~/content_library/video/`
- Move `content/text/*` if any
- Move `chroma-data/*` → `~/content_library/chroma-data/`
- Verify counts: `ls -1a` counts match, `chroma.sqlite3` size preserved
- Leave empty `content/` with `.gitignore` + placeholder so repo stays clonable

### Task 2: Update env + scripts
- `.env.example:10` `CONTENT_LIBRARY_DIR=/home/dennis/content_library`
- `.env` same
- `package.json:26` `db:chroma` → `bunx chroma run --path /home/dennis/content_library/chroma-data --host 127.0.0.1 --port 8000`
- `README.md` Output dir docs if references `content/`

### Task 3: Fix Gallery asset resolver (non-breaking)
- `src/db/db.ts:873-882 Gallery.getOutputAssetPath` + `Gallery.listItems:930` `Bun.file(getOutputAssetPath(...)).exists()`
- Change to resolve via `CONTENT_LIBRARY_DIR` first, fallback `OUTPUT_DIR` (or check both). Alternatively new helper `getContentLibraryPath`.
- Ensures gallery still shows migrated assets after move. Keep backward compat.

### Task 4: Verify
- `bunx chroma run --path ~/content_library/chroma-data` heartbeat + count
- `bun src/script/batch-embeddings.ts` (expect all already exists)
- `bunx tsc --noEmit` + `bun run lint` (if exists)
- Manual e2e: `bun start:hot` generate one asset → appears in new dir

## Dependencies: 1 → 2 → 3 → 4 (sequential)

## Effort: ~1h

