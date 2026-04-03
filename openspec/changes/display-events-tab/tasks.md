# Implementation Tasks: Display Events Tab

## 1. Backend - Events Endpoint

- [ ] 1.1 Create `/events` GET endpoint in the router that accepts `job_id` query parameter
- [ ] 1.2 Implement Kysely query to fetch events from `events` table filtered by `job_id`, ordered by `created_at` ASC
- [ ] 1.3 Handle case when job_id is missing or invalid - return empty array or error response
- [ ] 1.4 Create template/view function that renders events list as HTML fragment for HTMX response

## 2. Backend - Event Rendering Helpers

- [ ] 2.1 Create helper function to render image prompt event (prompt text + optional LoRA badge)
- [ ] 2.2 Create helper function to render video prompt event (prompt + source image filename)
- [ ] 2.3 Create helper function to render transition prompt event (prompt + start/end images)
- [ ] 2.4 Create helper function to render audio prompt event (prompt or "Instrumental" + duration)
- [ ] 2.5 Create helper function to render status badge (warning for pending, success for complete)

## 3. Frontend - Events List Component

- [ ] 3.1 Create DaisyUI timeline structure for events list using `timeline` and `timeline-middle` classes
- [ ] 3.2 Add event type icons/indicators to distinguish between image/video/audio/transition events
- [ ] 3.3 Implement empty state message ("No events yet") when no events exist for the job
- [ ] 3.4 Ensure proper escaping of user-generated content (prompts) to prevent XSS

## 4. Frontend - Events Tab Integration

- [ ] 4.1 Update events tab HTML to include HTMX `hx-get="/events?job_id=${jobId}"` attribute
- [ ] 4.2 Add loading indicator or skeleton state while events are being fetched
- [ ] 4.3 Ensure job_id is correctly passed from URL parameters or page context

## 5. Testing & Verification

- [ ] 5.1 Test endpoint with a job that has multiple event types
- [ ] 5.2 Test endpoint with a job that has no events (verify empty state)
- [ ] 5.3 Verify chronological ordering by created_at is correct
- [ ] 5.4 Verify status badges show correct colors for pending vs complete events
- [ ] 5.5 Test HTMX integration - verify events load dynamically when tab is clicked
