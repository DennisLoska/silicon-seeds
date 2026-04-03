# Design: Display Events Tab

## Context

The events tab already exists in the UI but currently displays no content. The backend has an `events` table with various event types (image prompts, video prompts, transition prompts, audio prompts) that are created as part of job processing. Users need visibility into these events to understand what was generated for their jobs.

**Current State:**
- Events tab exists but is empty
- Events are stored in SQLite `events` table with foreign key to `jobs`
- Multiple event types exist: `new_image_prompt`, `new_video_prompt`, `new_transition_prompt`, `new_audio_prompt`
- Project uses HTMX for server-side rendering and DaisyUI for styling

**Constraints:**
- Must use existing tech stack (HTMX, DaisyUI, Kysely/SQLite)
- No new dependencies allowed
- Events are already being stored; only display layer needed

## Goals / Non-Goals

**Goals:**
- Display all events for a job in chronological order by `created_at`
- Show appropriate information for each event type (prompt text, filenames, LoRA badges, etc.)
- Indicate pending vs complete status visually
- Handle empty state gracefully when no events exist
- Use DaisyUI timeline component for clean visual presentation

**Non-Goals:**
- Adding filtering or search capabilities
- Pagination (assume reasonable event counts per job)
- Editing or deleting events
- Real-time updates via websockets

## Decisions

### Decision 1: HTMX Server-Side Rendering

**Decision:** Use HTMX to load events server-side rather than client-side JavaScript with fetch.

**Rationale:**
- Consistent with existing project architecture (HTMX/SSE already in use)
- Simpler implementation - no need for React/Vue components or state management
- SEO-friendly and works without JavaScript enabled
- Leverages existing backend infrastructure

### Decision 2: DaisyUI Timeline Component

**Decision:** Use DaisyUI's timeline component to display events chronologically.

**Rationale:**
- Built-in vertical timeline with alternating left/right items looks professional
- Handles chronological ordering visually
- Minimal custom CSS needed
- Mobile-responsive out of the box

### Decision 3: Status Badge Colors

**Decision:** Use DaisyUI status badges with warning (yellow) for pending and success (green) for complete.

**Rationale:**
- Follows common UI conventions (warning = in progress, success = done)
- High contrast and accessible
- Consistent with other status indicators in the app

### Decision 4: Event Type Icons

**Decision:** Use simple emoji or SVG icons to distinguish event types visually.

**Rationale:**
- Quick visual scanning of mixed event types
- Emoji avoids additional asset files; fallback to text if needed
- Alternative considered: colored borders per type, but badges + timeline already provide enough visual distinction

### Decision 5: Endpoint Location

**Decision:** Create endpoint at `/events` with `job_id` query parameter.

**Rationale:**
- Simple RESTful naming
- Query parameter allows HTMX to pass job_id easily via `hx-get="/events?job_id=${jobId}"`
- Alternative considered: nested route `/jobs/:id/events`, but adds complexity for minimal benefit

## Risks / Trade-offs

**Risk:** Large number of events could slow page load.
→ **Mitigation:** Events per job expected to be small (<100). If needed, add pagination later. Index on `job_id` already exists in database schema.

**Risk:** Event data may contain special characters or HTML injection vectors.
→ **Mitigation:** Use proper template escaping when rendering user-generated content (prompts).

**Trade-off:** Server-side rendering means more server load vs client caching.
→ **Acceptance:** Trade-off is acceptable given small expected event counts and simplicity benefits.

## Migration Plan

1. Create `/events` endpoint in existing router
2. Add Kysely query to fetch events by job_id ordered by created_at
3. Create template/view for rendering events list with DaisyUI timeline
4. Update events tab to use HTMX `hx-get="/events?job_id=${jobId}"`
5. Test with jobs containing various event types
6. No database migrations required
7. Rollback: Simply remove endpoint and revert tab HTML if issues arise
