## ADDED Requirements

### Requirement: Index tracking for images
The system SHALL assign and store an `index` field for each image event, representing its intended position in the scene sequence.

#### Scenario: Image with index
- **WHEN** an image event is created via `ImageGenerator.schedule_image()`
- **THEN** if `index` is provided, it is stored in the event metadata

### Requirement: Index tracking for videos
The system SHALL assign and store an `index` field for each video event, representing its intended position in the final output sequence. Videos inherit their index from their source image.

#### Scenario: Video with index
- **WHEN** a video event is created via `VideoGenerator.schedule_video()`
- **THEN** if `index` is provided, it is stored in the event metadata

### Requirement: Index tracking for transitions
The system SHALL assign and store an `index` field for each transition event. Transitions between clip[i] and clip[i+1] SHALL have index=i.

#### Scenario: Transition with implicit index
- **WHEN** a transition event is created via `VideoGenerator.schedule_transition()`
- **THEN** the transition gets an implicit index based on its position in the sequence

### Requirement: Index preservation in task creation
When `JobOrchestrator.create_task()` creates events from `Partial<JobEvent>`, it SHALL preserve the `index` field if present.

#### Scenario: Index preserved through scheduler
- **WHEN** `schedule_image({ index: 0 })` is called
- **THEN** the resulting event in `jobs[jobId].events` has `index === 0`

### Requirement: Video file discovery
The system SHALL scan the job's output directory for all generated video files matching patterns `*.mp4` and `*.webm`.

#### Scenario: Find all video files
- **WHEN** the combiner scans a job's output directory
- **THEN** it identifies all `.mp4` and `.webm` files in that directory

### Requirement: Sort videos by explicit index
The system SHALL sort discovered video files by their `index` field (stored in event metadata) in ascending order, not by filename or timestamp.

#### Scenario: Sort files by index
- **WHEN** multiple video files exist with different index values
- **THEN** files are ordered from lowest to highest index value regardless of generation completion timing

### Requirement: Concatenate videos using ffmpeg
The system SHALL use ffmpeg's concat demuxer to concatenate all sorted video files into a single output file.

#### Scenario: Successful concatenation
- **WHEN** ffmpeg is available and all input files are valid MP4 or WebM format
- **THEN** a single combined video file is created at `output-combined.mp4` (or `.webm` per config)

### Requirement: Support configurable output format
The system SHALL allow configuration of the output file format via environment variable `COMBINED_OUTPUT_FORMAT` (default: `mp4`, alternative: `webm`).

#### Scenario: Output as WebM
- **WHEN** environment variable `COMBINED_OUTPUT_FORMAT=webm`
- **THEN** the combined output is created as `output-combined.webm`

### Requirement: Preserve source files
Source video files SHALL remain in place after concatenation completes. The combiner shall not delete any input files.

#### Scenario: Source preservation
- **WHEN** concatenation completes successfully
- **THEN** all original generated files are still present in the output directory with their original names

### Requirement: Error handling for missing ffmpeg
If ffmpeg is not available in PATH, the system SHALL log an error and skip the combiner step without failing the entire job.

#### Scenario: FFmpeg not found
- **WHEN** ffmpeg command is not in PATH (exit code 127 or "not found" message)
- **THEN** system logs error via `Logger.error()` and continues without combining

### Requirement: Error handling for invalid input files
If any input video file is corrupted or unreadable, the system SHALL log which file failed and continue with remaining files.

#### Scenario: Corrupted input detected
- **WHEN** ffmpeg encounters a corrupted video file during concat
- **THEN** the specific file is logged via `Logger.warn()` and processing continues with remaining files

### Requirement: Integration with JobOrchestrator completion
The combiner SHALL be triggered automatically when all tasks in a job reach "complete" status.

#### Scenario: Trigger on job completion
- **WHEN** last task in a job transitions to "complete" status
- **THEN** combiner is invoked for that job's output directory

### Requirement: Transition filename uniqueness
Each transition output file SHALL have a unique filename derived from its event ID, not using the default "video/ComfyUI" prefix.

#### Scenario: Unique transition filenames
- **WHEN** multiple transitions are generated for a job
- **THEN** each transition produces a uniquely named file (e.g., `trans_event_id_1.mp4`, `trans_event_id_2.mp4`)
