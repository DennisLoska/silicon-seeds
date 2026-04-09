## ADDED Requirements

### Requirement: Gallery page displays media assets in a responsive grid
The system SHALL display all media assets (images, videos, audio) from completed jobs in a responsive grid layout using DaisyUI card components.

#### Scenario: User views gallery on desktop
- **WHEN** user navigates to `/gallery` on a desktop browser
- **THEN** the page displays media items in a multi-column grid with cards that have hover effects

#### Scenario: User views gallery on mobile
- **WHEN** user navigates to `/gallery` on a mobile device
- **THEN** the page displays media items in a single or two-column layout appropriate for small screens

### Requirement: Gallery supports infinite scroll loading
The system SHALL automatically load additional media items when the user scrolls near the bottom of the gallery using HTMX's `revealed` trigger.

#### Scenario: User scrolls to bottom of gallery
- **WHEN** user scrolls down and the sentinel element enters the viewport
- **THEN** the system fetches the next batch of 20 media items and appends them to the grid

#### Scenario: User reaches end of available items
- **WHEN** there are no more media items to load
- **THEN** the system displays a "No more items" message instead of a loading spinner

### Requirement: Gallery shows loading indicator during fetch
The system SHALL display a loading spinner while fetching additional items via infinite scroll.

#### Scenario: Items are being loaded
- **WHEN** an HTMX request is in progress for new gallery items
- **THEN** a DaisyUI loading spinner is visible at the bottom of the grid

### Requirement: Gallery filters by media type
The system SHALL provide filter controls that allow users to display only images, videos, or audio files.

#### Scenario: User filters to show only images
- **WHEN** user selects the "Images" filter option
- **THEN** the gallery displays only image assets and subsequent infinite scroll requests return only images

#### Scenario: User switches from images to videos filter
- **WHEN** user changes filter from "Images" to "Videos"
- **THEN** the gallery refreshes to show only video assets

#### Scenario: User selects all media types
- **WHEN** user selects the "All" filter option
- **THEN** the gallery displays images, videos, and audio files mixed together

### Requirement: Gallery orders items by creation date descending
The system SHALL display media items ordered from newest to oldest based on event creation timestamp.

#### Scenario: User views newly populated gallery
- **WHEN** user navigates to `/gallery` after creating new jobs
- **THEN** the most recently created media assets appear at the top of the grid

### Requirement: Gallery excludes events without output files
The system SHALL filter out any events that do not have associated meta records with type='output'.

#### Scenario: Job has mixed success and failed events
- **WHEN** a job contains both successful events with outputs and failed events without outputs
- **THEN** only the successful events' media assets appear in the gallery

### Requirement: Gallery handles missing asset files gracefully
The system SHALL hide or gracefully handle media items where the referenced file does not exist on disk (404).

#### Scenario: Asset file is missing from disk
- **WHEN** a meta record references a file that no longer exists at the expected path
- **THEN** the card displays without showing a broken image icon, using CSS fallback styling

### Requirement: Gallery link in sidebar navigates to gallery page
The system SHALL provide a functional "Gallery" link as the second item in the sidebar navigation menu.

#### Scenario: User clicks Gallery sidebar link
- **WHEN** user clicks the "Gallery" link in the left sidebar
- **THEN** the browser navigates to `/gallery` and displays the gallery page with the link highlighted as active
