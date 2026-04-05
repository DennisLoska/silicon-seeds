# Render Job Media Tab

## Why

The job details page currently shows a placeholder in the "Media" tab instead of displaying actual generated assets (images, videos, and audio files). Users need to see their generated content directly within the job interface rather than navigating to external directories.

## What Changes

- Add media tab route handler that fetches job-associated assets from the database
- Display image gallery using DaisyUI carousel component
- Display video clips with HTML5 `<video>` players in DaisyUI cards
- Display audio files (TTS and instrumental) with HTML5 `<audio>` players
- Show status indicators for pending vs. completed assets using badges
- Expose media files via Bun's serveStatic middleware at /assets using OUTPUT_DIR

## Capabilities

### New Capabilities
- `job-media-display`: Fetches and displays all media assets associated with a job (images, videos, audio)
- `static-asset-serving`: Exposes media files via Bun's serveStatic middleware

### Modified Capabilities
- None - this is a new feature addition without modifying existing capability requirements

## Impact

- **Affected code**:
  - `src/api/media.ts` (new file) - route handler for media tab data
  - `src/templates/media.tsx` - replace placeholder with actual rendering logic
  - `src/db/tables.ts` - no changes needed, Events table already has all required fields
- **API endpoints**:
  - New: `GET /api/fragment/job/:jobId?tab=media`
- **Static route**: `/assets/*` → serves from OUTPUT_DIR
- **Dependencies**: Uses existing DaisyUI components (card, carousel, badge) and HTMX for tab navigation
