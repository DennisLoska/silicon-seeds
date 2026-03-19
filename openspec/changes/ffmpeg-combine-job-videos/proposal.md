## Why

The current video composition pipeline generates individual clips and transitions as separate files, then leaves it to users to manually combine them using external tools like ffmpeg. This creates an unnecessary manual step.

Current state:
- Job outputs contain multiple `.mp4` files: main clips and transitions
- No automated assembly mechanism exists
- The intended sequence order of videos is not tracked, making automatic combination unreliable

## What Changes

- Add automatic video concatenation as the final step in job processing
- Use ffmpeg to combine all generated videos in the correct sequence order
- Preserve source files during processing; only create combined output as final artifact
- Support configurable output format (`.mp4` or `.webm`) with `.mp4` as default
- **Add `index` tracking** to image, video, and transition events to ensure correct ordering regardless of generation completion timing

## Capabilities

### New Capabilities
- `ffmpeg-video-combiner`: Handles assembly of multiple video files using ffmpeg. Manages file discovery, ordering by explicit index, and produces a single combined output file.
- `video-sequence-indexing`: Adds optional `index` field to ImagePromptEvent, VideoPromptEvent, and TransitionPromptEvent to track intended sequence order independently from completion timing.

### Modified Capabilities
None - this introduces new capabilities without modifying existing specs.

## Impact

- **events.ts** (`src/events/events.ts:32-54`): Add `index?: number` to ImagePromptEvent, VideoPromptEvent, and TransitionPromptEvent interfaces
- **jobs.ts** (`src/jobs/jobs.ts:63-121`): Update `create_task()` to preserve `index` field across all event types
- **prompt-generator.ts** (`src/prompts/prompt-generator.ts:171-175`): Pass index from scenes array when scheduling image prompts, which flows through to video events
- **image-generator.ts** (`src/image/image-generator.ts:16-26`): Update schedule_image signature to accept and forward `index`
- **video-generator.ts** (`src/video/video-generator.ts:23-46`): Update schedule_video signature to accept and forward `index`
- **comfyui-client.ts** (`src/comfyui/comfyui-client.ts:267-273`): Override filename_prefix for transitions with event ID (currently uses default "video/ComfyUI")
- **JobOrchestrator** (`src/jobs/jobs.ts:14-41`): Use existing completion event handler to trigger combiner after all tasks complete
- **ffmpeg dependency**: Already used in codebase (see `meta.ts:40`, `video-generator.ts:186`) - no new external dependency needed
- **Output directory**: Creates `output-combined.mp4` alongside original generated files
- **Disk usage**: Temporary increase during processing (source + combined file exist simultaneously)
