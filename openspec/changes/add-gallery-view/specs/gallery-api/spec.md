## ADDED Requirements

### Requirement: Gallery endpoint returns paginated media items
The system SHALL provide a `/gallery/items` endpoint that returns HTML fragments containing up to 20 media item cards per request.

#### Scenario: First page load requests initial items
- **WHEN** the `/gallery` page loads and makes an initial request to `/gallery/items` without a cursor parameter
- **THEN** the endpoint returns the 20 most recent media items as HTML card fragments

#### Scenario: Infinite scroll requests additional items
- **WHEN** the infinite scroll sentinel triggers a request with a cursor timestamp parameter
- **THEN** the endpoint returns the next 20 items older than the cursor timestamp

### Requirement: Gallery items endpoint supports cursor-based pagination
The system SHALL use cursor-based pagination where the cursor is the `created_at` timestamp of the last item from the previous batch.

#### Scenario: Client requests second page with cursor
- **WHEN** client sends request to `/gallery/items?cursor=2024-01-15T10:30:00Z`
- **THEN** endpoint returns items where `created_at < '2024-01-15T10:30:00Z'` ordered descending, limited to 20

#### Scenario: Cursor prevents duplicate items
- **WHEN** new items are added to the database between pagination requests
- **THEN** cursor-based pagination ensures no items are skipped or duplicated across pages

### Requirement: Gallery items endpoint supports media type filtering
The system SHALL accept an optional `type` query parameter to filter results by media type (image, video, audio).

#### Scenario: Client requests only images
- **WHEN** client sends request to `/gallery/items?type=image`
- **THEN** endpoint returns only image assets based on file extension or metadata

#### Scenario: Client requests without type filter
- **WHEN** client sends request to `/gallery/items` without type parameter
- **THEN** endpoint returns all media types (images, videos, audio)

### Requirement: Gallery database query uses efficient JOIN
The system SHALL retrieve gallery items using a single SQL query that joins the `meta`, `events`, and `jobs` tables.

#### Scenario: Query retrieves item data
- **WHEN** the gallery endpoint executes its database query
- **THEN** it performs an INNER JOIN from meta → events → jobs, filtering for meta.type='output' and events.status IN ('success', 'completed')

### Requirement: Gallery excludes incomplete or failed events
The system SHALL only include media from events with status 'success' or 'completed'.

#### Scenario: Job has pending event
- **WHEN** a job contains an event with status 'pending' or 'running'
- **THEN** that event's outputs are excluded from gallery results

#### Scenario: Job has failed event
- **WHEN** a job contains an event with status 'failed'
- **THEN** that event is excluded from gallery results

### Requirement: Gallery main endpoint handles full page and HTMX requests
The system SHALL detect whether the request is an HTMX partial request or full page load and respond appropriately.

#### Scenario: Full page navigation to gallery
- **WHEN** user navigates to `/gallery` via browser address bar or sidebar link (no HX-Request header)
- **THEN** endpoint returns complete HTML document with layout, sidebar, and gallery content

#### Scenario: HTMX request for gallery content
- **WHEN** an HTMX request is made to `/gallery` (HX-Request header present)
- **THEN** endpoint returns only the gallery fragment without full page layout

### Requirement: Gallery returns appropriate HTTP status codes
The system SHALL return standard HTTP status codes for success and error conditions.

#### Scenario: Successful gallery request
- **WHEN** a valid GET request is made to `/gallery` or `/gallery/items`
- **THEN** endpoint returns HTTP 200 OK with HTML content

#### Scenario: Invalid cursor format
- **WHEN** a request includes a malformed cursor timestamp
- **THEN** endpoint either ignores the cursor (returns first page) or returns HTTP 400 Bad Request