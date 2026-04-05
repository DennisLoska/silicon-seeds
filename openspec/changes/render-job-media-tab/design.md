# Design Document: Render Job Media Tab

## Context

**Current State:**
- The job details page has three tabs: Status, Media, and Events
- The "Media" tab currently shows only a placeholder message
- Generated assets (images, videos, audio) are stored in ComfyUI directories (`OUTPUT_DIR`, `INPUT_DIR`)
- All asset metadata is tracked in the SQLite database via the `events` table with references to the `meta` table for file paths
- HTMX handles tab navigation through existing routes like `/api/fragment/job/:jobId?tab=media`

**Constraints:**
- Assets are served from ComfyUI's local filesystem, not a CDN
- DaisyUI 5 requires Tailwind CSS 4 (already configured via CDN)
- No build step required - templates render server-side
- HTMX expects HTML fragments for partial updates

## Goals / Non-Goals

**Goals:**
- Display all completed media assets associated with a job in organized sections
- Provide visual browsing of images using DaisyUI carousel
- Enable playback of video clips and audio files directly in the browser
- Show status indicators for pending vs. completed assets
- Maintain responsive design across mobile and desktop views

**Non-Goals:**
- Implement client-side asset caching or offline support
- Add media editing capabilities (crop, resize, etc.)
- Create a separate media library page - this is job-specific only
- Implement thumbnail generation - use original files directly

## Decisions

### 1. Data Fetching Strategy
**Decision:** Query `events` table filtered by `job_id`, then join with `meta` table for file paths.

**Rationale:**
- The `events` table already has all necessary fields: `mode`, `status`, `filename`, `subfolder`
- No need to modify database schema - existing structure supports this feature
- Query pattern: `SELECT e.*, m.filename, m.subfolder, m.type FROM events e LEFT JOIN meta m ON e.id = m.event_id WHERE e.job_id = ? AND e.status = 'complete'`

**Alternatives Considered:**
- Create a new `job_media` table - rejected because it would duplicate existing metadata
- Add columns to `events` table - rejected because `meta` table already handles file paths properly

### 2. Media Organization by Mode
**Decision:** Group assets by `mode` field (image, video, audio) and display in separate sections.

**Rationale:**
- Each mode has different display requirements:
  - Images: carousel/gallery layout
  - Videos: player with controls
  - Audio: simple playback widget
- Matches the existing event categorization in the codebase

### 3. Static Asset Serving via Bun Middleware
**Decision:** Use Bun's `serveStatic` middleware at `/assets/*` pointing directly to OUTPUT_DIR.

**Rationale:**
- Bun's serveStatic is efficient and requires no custom code
- Single route simplifies the implementation - just point to OUTPUT_DIR
- No need for MIME type handling - Bun automatically detects content types from file extensions
- Simpler than creating a custom Hono route with manual file reading and MIME type detection
- The `subfolder` field in meta table already contains relative paths, so `/assets/subfolder/filename.png` works directly

### 4. DaisyUI Component Selection
**Decision:** Use the following components:
- `card bg-base-200` for container sections
- `carousel` for image gallery
- HTML5 `<video>` and `<audio>` elements (no special DaisyUI component needed)
- `badge badge-success` for completed status, `badge-warning` for pending

**Rationale:**
- Cards provide consistent styling across all media types
- Carousel is the only DaisyUI component designed specifically for image galleries
- HTML5 media elements are sufficient - no need for custom players
- Badges match existing status indicators in other tabs

### 5. HTMX Integration
**Decision:** No changes needed to tab navigation - existing HTMX attributes will work.

**Rationale:**
- `job-detail.tsx` already has the correct HTMX setup:
  ```tsx
  hx-get={`/api/fragment/job/${jobId}?tab=media`}
  hx-target="#job-tabs-container"
  hx-swap="innerHTML"
  ```
- The media route just needs to return an HTML fragment that replaces the placeholder

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Large jobs with many assets could cause slow page loads | Consider pagination or lazy loading in future iteration; start with all assets displayed |
| Missing files (deleted from ComfyUI) could cause 404 errors | Add error handling to display "file not found" placeholder instead of breaking the UI |
| Browser compatibility for video formats | Use widely supported formats (MP4/H.264); WAN 2.2 outputs standard formats |
| Audio autoplay issues in modern browsers | Don't auto-play; require user interaction to start playback |

## Migration Plan

This is a new feature addition with no migration required:
1. Configure Bun's serveStatic middleware in `src/api/api.tsx` pointing to OUTPUT_DIR
2. Create `src/api/media.ts` route handler
3. Update `src/templates/media.tsx` with rendering logic
4. Test with existing jobs that have completed media generation

## Open Questions

1. Should we show pending assets at all, or only display completed ones?
   - **Tentative decision:** Show completed assets; optionally add a "pending" section if useful
2. What video format does WAN 2.2 output? (Need to verify for HTML5 compatibility)
3. Should audio files auto-play when the tab is opened, or require user interaction?
