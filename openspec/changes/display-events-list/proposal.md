<!-- Use this as the structure for your output file. Fill in the sections. -->
## Why

The events tab currently exists but doesn't display any event data. Users cannot see the history of events (image prompts, video prompts, transitions, audio generation) associated with their jobs, making it difficult to track job progress and understand what has been generated.

## What Changes

- Add backend endpoint to fetch events from the `events` table filtered by `job_id`
- Create frontend template using DaisyUI timeline component to display events chronologically
- Each event displays: type icon, status badge (Complete/Pending), timestamp, metadata badges, and prompt content
- Events are expandable/collapsible for detailed view of prompts and metadata
- Use HTMX for server-side rendering with seamless client interactions

## Capabilities

### New Capabilities
<!-- Capabilities being introduced. Replace <name> with kebab-case identifier (e.g., user-auth, data-export, api-rate-limiting). Each creates specs/<name>/spec.md -->
- None - this is a UI feature implementation using existing database schema and event types

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->
- None - no existing capability requirements are being modified

## Impact

**Backend:**
- New route: `GET /api/events/` with query param `job_id`
- Database queries via Kysely to fetch events from `events` table
- Event types already defined in `src/events/events.ts`: NewImagePrompt, NewVideoPrompt, NewTransitionPrompt, NewAudioPrompt

**Frontend:**
- New template: `src/templates/events-list.tsx` with `eventsListFragment()` function
- DaisyUI timeline component for vertical chronological display
- HTMX integration for tab switching (existing pattern)

**No breaking changes.**
