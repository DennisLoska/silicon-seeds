# Job Media Display Specification

## ADDED Requirements

### Requirement: System SHALL fetch media assets for a job
The system SHALL retrieve all completed media assets associated with a specific job from the database.

#### Scenario: Fetch completed image assets
- **WHEN** user navigates to job details page with media tab selected
- **THEN** system queries events table filtered by job_id AND status='complete' AND mode='image'

#### Scenario: Fetch completed video assets
- **WHEN** user navigates to job details page with media tab selected
- **THEN** system queries events table filtered by job_id AND status='complete' AND mode='video'

#### Scenario: Fetch completed audio assets
- **WHEN** user navigates to job details page with media tab selected
- **THEN** system queries events table filtered by job_id AND status='complete' AND mode='audio'

### Requirement: System SHALL join event metadata for file paths
The system SHALL retrieve file path information (filename, subfolder, type) from the meta table.

#### Scenario: Retrieve image file paths
- **WHEN** fetching image assets
- **THEN** system LEFT JOINs events with meta on event_id to obtain filename, subfolder, and type fields

### Requirement: System SHALL display images in carousel format
The system SHALL present all completed image assets using a DaisyUI carousel component.

#### Scenario: Display single image
- **WHEN** job has one completed image asset
- **THEN** system renders a carousel with that single image as the only item

#### Scenario: Display multiple images
- **WHEN** job has multiple completed image assets
- **THEN** system renders a carousel with all images, each in its own carousel-item div

### Requirement: System SHALL display videos with player controls
The system SHALL present all completed video assets using HTML5 `<video>` elements.

#### Scenario: Display single video clip
- **WHEN** job has one completed video asset (clip)
- **THEN** system renders a DaisyUI card containing an HTML5 video element with controls attribute

#### Scenario: Display transition videos
- **WHEN** job has completed transition video assets
- **THEN** system renders each transition in its own card section labeled as "Transition"

### Requirement: System SHALL display audio players
The system SHALL present all completed audio assets using HTML5 `<audio>` elements.

#### Scenario: Display TTS audio
- **WHEN** job has a completed TTS (speech) asset
- **THEN** system renders a DaisyUI card containing an HTML5 audio element with controls attribute and label "Voiceover"

#### Scenario: Display instrumental audio
- **WHEN** job has a completed instrumental asset
- **THEN** system renders a DaisyUI card containing an HTML5 audio element with controls attribute and label "Background Music"

### Requirement: System SHALL show status indicators for pending assets
The system SHALL display badges indicating whether assets are complete or still pending.

#### Scenario: Show badge for completed image
- **WHEN** user views media tab and image is complete
- **THEN** system displays a green `badge badge-success` next to the asset

#### Scenario: Show badge for pending asset
- **WHEN** user views media tab and asset is still being generated
- **THEN** system displays an orange `badge badge-warning` with text "Generating..."
