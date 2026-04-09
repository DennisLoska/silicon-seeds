<!-- Use this as the structure for your output file. Fill in the sections. -->
## Why

Users currently have no centralized way to browse all generated media assets across their jobs. Each job's assets are siloed within individual job views, making it difficult to discover, compare, or reuse previously generated content. A gallery view provides a unified browsing experience for all media outputs.

## What Changes

- Add new `/gallery` route with dedicated page template serving the gallery layout, filters, and initial items
- Implement `/gallery/items` endpoint for HTMX-driven infinite scroll that returns paginated item fragments
- Create database query to aggregate assets from all jobs' events and meta records
- Add filter controls for media type (images, videos, audio) and sort options
- Gallery link already exists in sidebar (`/src/templates/app.tsx:109-113`) - will become functional

## Capabilities

### New Capabilities
- `gallery-view`: Core gallery browsing capability with infinite scroll pagination, media type filtering, and asset display grid. Covers the main gallery page template, route handler, and frontend interaction patterns.
- `gallery-api`: Backend API endpoint for fetching paginated gallery items. Handles database queries to aggregate assets across all jobs, supports filtering by media type, sorting, and cursor-based pagination for infinite scroll.

### Modified Capabilities
- None - this change introduces entirely new functionality without modifying existing capabilities.

## Impact

**New Files:**
- `src/api/gallery/index.tsx` - Route handler for `/gallery` page and `/gallery/items` infinite scroll endpoint
- `src/templates/gallery.tsx` - Gallery page template component

**Modified Files:**
- `src/api/api.tsx` - Register new `/gallery` route
- `src/templates/templates.ts` - Export new Gallery template
- `src/db/db.ts` - Add new `Gallery` namespace with database query functions for gallery data aggregation

**Database:**
- No schema changes required
- Reads from existing `jobs`, `events`, and `meta` tables
- May benefit from indexes on `events.job_id` and `meta.event_id` for performance

**Frontend:**
- Reuses existing media rendering patterns from `src/templates/media.tsx`
- Uses HTMX `hx-trigger="revealed"` for infinite scroll (native htmx pattern)
- DaisyUI components: `card` with `figure` for media display, responsive grid using Tailwind CSS utility classes
