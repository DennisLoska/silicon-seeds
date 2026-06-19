# HyperCut: Filter autocut_cut from User-Facing Suggestions

## Problem

`findSuggestionsByJob()` returns all `hypercut_suggestions` entries including `source_type = 'autocut_cut'`. These represent filler/pause/restart removal markers from WhisperX transcript analysis — they mark content to cut FROM the source video, not additional assets to add. Displaying them as user-facing "suggestions" (with "Add" button) is confusing and nonsensical.

## Solution

Filter `source_type = 'autocut_cut'` from all user-facing suggestion queries. Keep the entries in the DB (agent's `get_transcript_words` tool needs them).

### Changes

1. **`src/db/db.ts`** — Add `findContentSuggestionsByJob()` that filters `source_type != 'autocut_cut'`
2. **`src/api/api/hypercut.ts`** — Update `get_suggestions` handler to use new filtered query
3. **`src/hypercut/agentic-editor.ts`** — Update `get_suggestions` tool to use new filtered query + update description

### Non-changes

- `findSuggestionsByJob()` kept as-is (agent's `get_transcript_words` tool needs autocut_cut)
- No schema changes, no migration
- No changes to autocut feature (completely separate)
