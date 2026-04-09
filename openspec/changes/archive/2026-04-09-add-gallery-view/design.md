## Context

The Silicon Seeds application currently displays media assets (images, videos, audio) within individual job views. Users must navigate to each job separately to see its outputs. The database stores this data across three tables:
- `jobs`: Job metadata and creation timestamps
- `events`: Processing events linked to jobs with status information
- `meta`: File references (filename, subfolder, type) linked to events

The sidebar already has a Gallery link (`/src/templates/app.tsx:109-113`) but no route handler exists.

## Goals / Non-Goals

**Goals:**
- Provide a unified view of all media assets across all jobs
- Implement infinite scroll for seamless browsing without pagination controls
- Support filtering by media type (images, videos, audio)
- Use HTMX for server-driven updates without custom JavaScript
- Follow existing codebase patterns (Hono routes, JSX templates, Kysely queries)
- Filter out events without output files at the database level

**Non-Goals:**
- User authentication or access control for gallery items
- Asset editing or deletion from gallery view
- Advanced search functionality (keyword-based)
- Bulk operations on multiple assets
- Real-time updates when new jobs complete

## Decisions

### Decision 1: HTMX Infinite Scroll with `hx-trigger="revealed"`

**Chosen approach:** Use a sentinel div at the bottom of the gallery that triggers `/gallery/items` when scrolled into view.

```html
<div id="gallery-grid">
  <!-- initial items -->
</div>
<div hx-get="/gallery/items"
     hx-trigger="revealed"
     hx-swap="beforeend"
     hx-target="#gallery-grid"
     hx-vals='{"cursor": "{{last_item_id}}"}'>
  <span class="loading loading-spinner"></span>
</div>
```

**Alternatives considered:**
- **Scroll event listener with custom JS**: More control but violates the HTMX philosophy of declarative HTML. Requires maintaining JavaScript state.
- **Traditional pagination buttons**: Simpler to implement but creates friction in browsing experience. Users must actively click "Load More" or page numbers.

**Rationale:** The `revealed` trigger is a native HTMX special event that fires when an element enters the viewport. It requires no custom JavaScript, works progressively (degrades to nothing on non-JS browsers), and provides the smoothest UX for browsing large collections.

### Decision 2: Cursor-Based Fetching (Supports Infinite Scroll)

**Chosen approach:** Cursor-based fetching using the last item's created_at timestamp. This backend mechanism supports the infinite scroll UX by efficiently retrieving subsequent batches of items.

Note: "Infinite scroll" is the user-facing interaction pattern (content loads as you scroll). "Cursor-based fetching" is how we retrieve data from the database to support that pattern.

```typescript
// Query pattern
const items = await DB.db
  .selectFrom('meta')
  .innerJoin('events', 'events.id', 'meta.event_id')
  .where('meta.type', '=', 'output')
  .where('events.status', 'inArray', ['success', 'completed'])
  .orderBy('events.created_at', 'desc')
  .limit(20)
  .execute();
```

With cursor:
```typescript
.where('events.created_at', '<', cursorTimestamp)
```

**Alternatives considered:**
- **Offset/Limit pagination**: Simpler to implement but causes performance degradation with large offsets and can return duplicate/skipped items if data changes between requests.

**Rationale:** Cursor-based pagination is more performant for infinite scroll scenarios, handles concurrent modifications gracefully, and provides consistent results across paginated requests. The `created_at` field naturally orders assets chronologically which matches user expectations.

### Decision 3: Single JOIN Query in Gallery Namespace

**Chosen approach:** Create a dedicated `Gallery.listItems()` function that performs a single query joining all three tables.

```typescript
export const Gallery = {
  async listItems(options: { cursor?: string; type?: 'image' | 'video' | 'audio'; limit?: number }) {
    return await DB.db
      .selectFrom('meta')
      .innerJoin('events', 'events.id', 'meta.event_id')
      .innerJoin('jobs', 'jobs.id', 'events.job_id')
      .selectAll()
      .where('meta.type', '=', 'output')
      .where('events.status', 'inArray', ['success', 'completed'])
      // optional filters
      .orderBy('events.created_at', 'desc')
      .limit(options.limit ?? 20)
      .execute();
  }
};
```

**Alternatives considered:**
- **N+1 queries using existing modules**: Call `Jobs.list()`, then for each job call `Events.findByJobId()`, then for each event call `Meta.findByEventId()`. This would generate hundreds of queries for a typical dataset.
- **Separate gallery database module file**: Create `src/db/gallery.ts` as a standalone module. Adds file complexity without clear benefit since the namespace pattern keeps related code together.

**Rationale:** A single JOIN query is dramatically more efficient than N+1 queries, especially as the dataset grows. Using a namespace within `db.ts` follows the existing pattern (Jobs, Events, Meta namespaces) and avoids creating unnecessary file fragmentation.

### Decision 4: Two Endpoints in Single Route File

**Chosen approach:** Both `/gallery` and `/gallery/items` handled by `src/api/gallery/index.tsx`.

```typescript
const app = new Hono();

app.get('/', handler);      // Full page + initial items
app.get('/items', itemsHandler);  // Paginated fragments only
```

**Alternatives considered:**
- **Separate files**: `index.tsx` for page, `items.tsx` for endpoint. Over-engineered for two simple handlers.
- **Single endpoint with query params**: Use `/gallery?loadMore=true&cursor=xxx`. Mixes concerns and makes URL sharing confusing.

**Rationale:** Keeping both endpoints in one file follows the existing pattern (e.g., jobs routes) and maintains clear separation between page rendering and data fetching while avoiding unnecessary file proliferation.

### Decision 5: DaisyUI Card Component for Media Items

**Chosen approach:** Use `card` component with `figure` for media display, leveraging existing patterns from `src/templates/media.tsx`.

```tsx
<div class="card bg-base-200 hover:scale-105 transition-transform">
  <figure>
    <img src={assetPath} alt={filename} />
  </figure>
</div>
```

**Alternatives considered:**
- **Custom grid with raw Tailwind classes**: More flexibility but reinvents the wheel and loses DaisyUI theming benefits.
- **Carousel component**: Better for horizontal scrolling but doesn't fit the gallery browsing mental model.

**Rationale:** The card component provides built-in hover states, consistent spacing, and theme-aware colors. It matches existing media display patterns in the codebase (media.tsx) ensuring visual consistency.

## Risks / Trade-offs

**[Performance] Large datasets may slow initial query**: If users have thousands of jobs with many events each, the JOIN query could become slow.
→ *Mitigation:* Add database indexes on `events.job_id`, `events.status`, and `meta.event_id`. Consider adding a composite index on `(status, created_at)` for the common filter/sort pattern.

**[UX] No loading state between infinite scroll requests**: Users might not know if more content is being loaded or if they've reached the end.
→ *Mitigation:* Include a spinner in the sentinel div that disappears when new items arrive. Add a "No more items" message when pagination completes.

**[Accessibility] HTMX swaps may not announce to screen readers**: Dynamic content injection might not be announced to assistive technologies.
→ *Mitigation:* Use `aria-live="polite"` on the gallery grid container. Consider adding `HX-Trigger-After-Swap` headers to fire custom events for ARIA updates if needed.

**[Trade-off] No client-side caching of assets**: Each scroll request hits the database fresh.
→ *Mitigation deferred:* Could add Redis caching or browser-level caching headers in a future iteration if performance becomes an issue.

## Migration Plan

### Implementation Steps

1. **Add database queries** (`src/db/db.ts`)
   - Add `Gallery` namespace with `listItems()` function
   - Test query performance with sample data

2. **Create route handler** (`src/api/gallery/index.tsx`)
   - Implement `/gallery` endpoint returning full page or fragment based on HX-Request header
   - Implement `/gallery/items` endpoint for paginated items
   - Register route in `src/api/api.tsx`

3. **Create template component** (`src/templates/gallery.tsx`)
   - Build gallery grid with filter controls
   - Add HTMX infinite scroll sentinel
   - Export component in `src/templates/templates.ts`

4. **Test end-to-end**
   - Verify navigation from sidebar works
   - Test infinite scroll loads additional items
   - Verify filters work correctly
   - Check responsive behavior on mobile

### Rollback Strategy

If issues arise:
1. Remove route registration from `src/api/api.tsx`
2. Disable Gallery link in sidebar by commenting out or removing the sidebar item
3. No database changes were made, so no migration rollback needed

## Open Questions

- Should we add a "Load All" button for users who want to see everything at once (useful for small datasets)?

## Decisions Made During Review

- **404 handling**: Hide missing images gracefully - use CSS `object-fit: contain` with fallback styling, don't show broken image icons
- **Events without outputs**: Filter out at database level by only selecting events that have corresponding meta records with `type='output'` (already handled by INNER JOIN)
