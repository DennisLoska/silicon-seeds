# Static Asset Serving Specification

## ADDED Requirements

### Requirement: System SHALL serve media files via static route at /assets/*
The system SHALL expose generated output assets through a single static route that maps directly to OUTPUT_DIR.

#### Scenario: Serve image file with subfolder
- **WHEN** client requests `/assets/subfolder/image.png`
- **THEN** Bun's serveStatic middleware serves the file from OUTPUT_DIR/subfolder/image.png with automatic MIME type detection

#### Scenario: Serve video file
- **WHEN** client requests `/assets/video.mp4`
- **THEN** Bun's serveStatic middleware serves the file from OUTPUT_DIR/video.mp4 with content-type "video/mp4"

#### Scenario: Serve audio file
- **WHEN** client requests `/assets/audio.wav`
- **THEN** Bun's serveStatic middleware serves the file from OUTPUT_DIR/audio.wav with content-type "audio/wav"


