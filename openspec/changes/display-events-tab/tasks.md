# Implementation Tasks: Display Events Tab

## 1. Backend - Events Endpoint

- [x] 1.1 Create `/events` GET endpoint in the router that accepts `job_id` query parameter
- [x] 1.2 Implement Kysely query to fetch events from `events` table filtered by `job_id`, ordered by `created_at` ASC
- [x] 1.3 Handle case when job_id is missing or invalid - return empty array or error response
- [x] 1.4 Create template/view function that renders events list as HTML fragment for HTMX response

## 2. Backend - Event Rendering Helpers

- [x] 2.1 Create helper function to render image prompt event (prompt text + optional LoRA badge)
- [x] 2.2 Create helper function to render video prompt event (prompt + source image filename)
- [x] 2.3 Create helper function to render transition prompt event (prompt + start/end images)
- [x] 2.4 Create helper function to render audio prompt event (prompt or "Instrumental" + duration)
- [x] 2.5 Create helper function to render status badge (warning for pending, success for complete)

## 3. Frontend - Events List Component

- [x] 3.1 Create DaisyUI timeline structure for events list using `timeline` and `timeline-middle` classes
- [x] 3.2 Add event type icons/indicators to distinguish between image/video/audio/transition events
- [x] 3.3 Implement empty state message ("No events yet") when no events exist for the job
- [x] 3.4 Ensure proper escaping of user-generated content (prompts) to prevent XSS

## 4. Frontend - Events Tab Integration

- [x] 4.1 Update `src/templates/events.tsx` to include HTMX container that loads from `/events?job_id=${jobId}`
- [x] 4.2 Add loading indicator or skeleton state while events are being fetched
- [x] 4.3 Ensure job_id is correctly passed from URL parameters or page context
