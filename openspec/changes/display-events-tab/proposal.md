<!-- Use this as the structure for your output file. Fill in the sections. -->
## Why

The events tab currently exists but does not display any content. Users cannot see the history of generation events (image prompts, video prompts, transitions, audio prompts) associated with their jobs, making it difficult to track what was generated and in what order.

## What Changes

- Add HTMX endpoint `/events` that fetches events from the database filtered by `job_id`
- Create events list UI component using DaisyUI displaying all event types for a job
- Render different event types with appropriate visual representation:
  - Image prompts: show prompt text and optional LoRA badge
  - Video prompts: show prompt and source image reference
  - Transition prompts: show start/end images and transition description
  - Audio prompts: show prompt (if any) and duration
- Display events ordered chronologically by `created_at` timestamp

## Capabilities

### New Capabilities
- `events-display`: UI component and backend endpoint for listing and displaying job events in a timeline/list format using DaisyUI styling and HTMX for dynamic loading

### Modified Capabilities
<!-- Existing capabilities whose REQUIREMENTS are changing (not just implementation).
     Only list here if spec-level behavior changes. Each needs a delta spec file.
     Use existing spec names from openspec/specs/. Leave empty if no requirement changes. -->
- None - this is a new feature that doesn't modify existing capability requirements

## Impact

- **Backend**: New HTMX endpoint `/events` querying the `events` table
- **Frontend**: New events list component in the events tab using DaisyUI classes
- **Database**: Reads from existing `events` table (no schema changes)
- **Dependencies**: Uses existing DaisyUI and HTMX setup; no new dependencies required
