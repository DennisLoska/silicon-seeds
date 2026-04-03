## ADDED Requirements

### Requirement: Events endpoint exists
The system SHALL provide an HTMX endpoint at `/events` that accepts a `job_id` query parameter and returns HTML rendering of events for that job.

#### Scenario: Valid job ID provided
- **WHEN** user requests `/events?job_id=<valid-id>`
- **THEN** system returns HTML fragment with events list for that job

#### Scenario: Invalid or missing job ID
- **WHEN** user requests `/events` without `job_id` parameter
- **THEN** system returns empty HTML fragment or error message

### Requirement: Events fetched from database
The system SHALL query the `events` table filtering by `job_id` and ordering by `created_at` field ascending.

#### Scenario: Job has events
- **WHEN** job with given ID has associated events in database
- **THEN** all events for that job are retrieved ordered chronologically by creation time

#### Scenario: Job has no events
- **WHEN** job with given ID has no associated events
- **THEN** empty result set is returned and UI shows appropriate message

### Requirement: Events displayed in list format
The system SHALL render events using DaisyUI timeline or list component showing event type, timestamp, and relevant data.

#### Scenario: Multiple events exist
- **WHEN** job has multiple events
- **THEN** each event is rendered as a separate item in chronological order by index

### Requirement: Image prompt events displayed correctly
The system SHALL render `new_image_prompt` events showing the prompt text and optional LoRA badge if present.

#### Scenario: Image prompt with LoRA
- **WHEN** image prompt event has a `lora` field set
- **THEN** prompt text is shown along with a DaisyUI badge displaying the LoRA name

#### Scenario: Image prompt without LoRA
- **WHEN** image prompt event has no `lora` field
- **THEN** only the prompt text is displayed

### Requirement: Video prompt events displayed correctly
The system SHALL render `new_video_prompt` events showing the prompt text and source image filename.

#### Scenario: Video prompt exists
- **WHEN** video prompt event is present
- **THEN** prompt text and source image reference (filename) are both displayed

### Requirement: Transition prompt events displayed correctly
The system SHALL render `new_transition_prompt` events showing the transition description, start image, and end image.

#### Scenario: Transition prompt exists
- **WHEN** transition prompt event is present
- **THEN** prompt text, start image filename, and end image filename are all displayed

### Requirement: Audio prompt events displayed correctly
The system SHALL render `new_audio_prompt` events showing the prompt text (if present) and duration.

#### Scenario: Audio prompt with prompt text
- **WHEN** audio prompt event has a non-null `prompt` field
- **THEN** prompt text is displayed along with duration if specified

#### Scenario: Instrumental audio (no prompt)
- **WHEN** audio prompt event has null `prompt` field
- **THEN** "Instrumental" or similar indicator is shown with duration if specified

### Requirement: Event status indicated visually
The system SHALL display the current status (`pending` or `complete`) of each event using DaisyUI status badges or indicators.

#### Scenario: Pending event
- **WHEN** event has status `pending`
- **THEN** visual indicator shows pending state (e.g., warning/yellow badge)

#### Scenario: Complete event
- **WHEN** event has status `complete`
- **THEN** visual indicator shows complete state (e.g., success/green badge)

### Requirement: Empty state handled gracefully
The system SHALL display a user-friendly message when no events exist for the selected job.

#### Scenario: No events for job
- **WHEN** queried job has zero events in database
- **THEN** friendly message such as "No events yet" is displayed instead of empty list
