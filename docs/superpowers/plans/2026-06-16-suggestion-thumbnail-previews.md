# Suggestion Thumbnail Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace asset_id text display in suggestion cards with image/video thumbnail previews

**Architecture:** LEFT JOIN meta table in findSuggestionsByJob query to get meta.filename, then render img/video elements in the HypercutSuggestions template with /assets/<filename> URLs. Keep type badge, timestamps, add/skip buttons.

**Tech Stack:** Bun, Kysely/SQLite, Hono JSX templates

---

### Task 1: Add meta LEFT JOIN to findSuggestionsByJob

**Files:**
- Modify: `src/db/db.ts:860-866`

- [ ] **Step 1: Update the query to join meta table**

Modify `findSuggestionsByJob` to LEFT JOIN `meta` on `asset_id` and select `meta.filename` as `meta_filename`:

```typescript
export async function findSuggestionsByJob(jobId: string) {
  return await db
    .selectFrom("hypercut_suggestions")
    .leftJoin("meta", "meta.id", "hypercut_suggestions.asset_id")
    .where("job_id", "=", jobId)
    .orderBy("transcript_anchor_start", "asc")
    .select([
      "hypercut_suggestions.id",
      "hypercut_suggestions.created_at",
      "hypercut_suggestions.job_id",
      "hypercut_suggestions.source_type",
      "hypercut_suggestions.asset_id",
      "hypercut_suggestions.text_content",
      "hypercut_suggestions.transcript_anchor_start",
      "hypercut_suggestions.transcript_anchor_end",
      "hypercut_suggestions.score",
      "hypercut_suggestions.status",
      "meta.filename as meta_filename",
    ])
    .execute();
}
```

- [ ] **Step 2: Verify query compiles**

Run: `bun check` or `bun run typecheck` — should pass

### Task 2: Update HypercutSuggestionSchema to include meta_filename

**Files:**
- Modify: `src/db/db.ts:108-110`

- [ ] **Step 1: Extend the schema type**

Add optional `meta_filename` to the suggestion type:

```typescript
export type HypercutSuggestionSchema = Omit<DbSchema["hypercut_suggestions"], "created_at"> & {
  created_at: string;
  meta_filename?: string;
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `bun run typecheck` — should pass

### Task 3: Update HypercutSuggestions template to show thumbnail previews

**Files:**
- Modify: `src/templates/hypercut.tsx:126-174`

- [ ] **Step 1: Replace text/ID display with thumbnail preview**

Replace the body content of each suggestion card. The current text line that shows `{s.text_content ?? s.asset_id ?? "content"}` and the simple source_type badge should become:

- For `autocut_cut`: show text_content in a truncated paragraph (no thumbnail)
- For `image`/`video`: show img or video thumbnail at 96px height
- Keep source_type badge (but maybe smaller/overlaid on thumbnail)
- Keep timestamps and add/skip buttons
- Remove asset_id fallback

```tsx
{props.suggestions.map((s) => (
  <div
    key={s.id}
    class={`card card-compact ${
      s.source_type === "autocut_cut"
        ? "bg-error/10 border border-error/30"
        : "bg-base-100 shadow-sm"
    }`}
  >
    <div class="card-body p-3">
      {s.source_type !== "autocut_cut" && s.meta_filename ? (
        <figure class="relative">
          {s.source_type === "video" ? (
            <video
              src={`/assets/${s.meta_filename}`}
              class="w-full h-24 object-cover rounded"
              muted
            />
          ) : (
            <img
              src={`/assets/${s.meta_filename}`}
              class="w-full h-24 object-cover rounded"
            />
          )}
          <span
            class={`badge badge-xs absolute top-1 left-1 ${
              s.source_type === "video" ? "badge-accent" : "badge-primary"
            }`}
          >
            {s.source_type}
          </span>
        </figure>
      ) : (
        <div class="flex items-start gap-2">
          <span
            class={`badge badge-sm ${
              s.source_type === "autocut_cut"
                ? "badge-error"
                : "badge-primary"
            }`}
          >
            {s.source_type}
          </span>
          {s.text_content && (
            <p class="text-sm truncate flex-1">{s.text_content}</p>
          )}
        </div>
      )}
      <div class="flex justify-between items-center mt-1">
        <p class="text-xs opacity-60">
          {s.transcript_anchor_start.toFixed(2)}s - {s.transcript_anchor_end.toFixed(2)}s
        </p>
        <div class="card-actions flex-nowrap">
          <button
            class="btn btn-xs btn-success add-to-timeline"
            data-suggestion-id={s.id}
            data-job-id={props.jobId}
          >
            Add
          </button>
          <button
            class="btn btn-xs btn-ghost"
            hx-post={`/api/jobs/hypercut/suggestions/${s.id}/reject`}
            hx-swap="none"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  </div>
))}
```

### Task 4: Verify the build

**Files:**
- N/A

- [ ] **Step 1: Run typecheck**

Run: `bun run typecheck` — should pass

- [ ] **Step 2: Build check**

Run: `bun run build` — should work

- [ ] **Step 3: Visual verification**

Start server: `bun start:hot`
Open browser to a HyperCut job page with suggestions
Verify:
- Content suggestions show image/video thumbnail
- autocut_cut suggestions show text
- All have timestamps and add/skip buttons
- No raw asset_id visible
