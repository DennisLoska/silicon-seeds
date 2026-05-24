# Silicon-Seeds

Whoever has ears, let them hear.

Silicon-Seeds is a Bun-based generative media orchestration app that turns text into image sequences, videos, transitions, speech, and music by coordinating LM Studio, ComfyUI, SQLite, and a server-rendered HTMX UI.

## What It Does

The app currently supports two main interactive flows:

- `Compose`: create a full video job from a script or uploaded text file
- `Image`: create one or more standalone images from a prompt

For compose jobs, the system:

1. stores a job record in SQLite
2. stores the source script as an event
3. generates speech audio
4. derives clip count from speech duration
5. generates chronological scene prompts
6. creates images for those scenes
7. generates indexed videos from those images
8. generates indexed transitions between adjacent videos
9. concatenates the final composition

All job state and asset metadata are persisted in SQLite. Generated media files live on disk under the configured ComfyUI directories, and the UI updates via HTMX fragment fetches triggered by SSE notifications.

## Architecture

The runtime is centered around four systems:

- `Hono + JSX`: HTTP server, SSR templates, fragment endpoints
- `SQLite + Kysely`: durable jobs, events, and asset metadata
- `LM Studio`: text generation, scene generation, video prompt generation, job naming
- `ComfyUI`: image, video, transition, TTS, and instrumental generation

### Core Concepts

#### Jobs

Jobs are top-level units of work stored in the `jobs` table.

Each job has:

- `id`
- `created_at`
- lifecycle `status`: `active | complete | failed | cancelled`
- render/model settings such as `fps`, `clip_duration`, `transition_duration`, `resolution`, `image_model`, `video_model`, `style_preset`
- generated `name`

#### Events

Events are the durable queue and execution log for all work in the `events` table.

Each event has:

- execution `status`: `pending | running | complete | failed`
- `type`: text, image, video, transition, audio, composition
- `mode`: text, image, video, speech, instrumental
- optional `index` for ordered media in compose mode
- `priority` for queue selection
- `claimed_at`, `attempt_count`, `error`

Compose ordering is driven by `index`, not by insertion order.

#### Meta

The `meta` table stores generated asset locations:

- `filename`
- `subfolder`
- `type`: `input | output | temp`

This lets the app map events back to real images, videos, and audio files produced by ComfyUI.

## Queue Model

The queue is DB-backed, not in-memory.

Important properties:

- only one media generation runs globally at a time
- queue selection happens from SQLite
- priority is enforced at event level

Current priority ordering:

- audio: `300`
- image: `200`
- video and transition: `100`

Queue selection is performed from pending active-job events ordered by:

1. `priority desc`
2. `index asc`
3. `created_at asc`

This keeps compose media deterministic while preserving global media priority.

## Compose Pipeline

The compose flow starts at `POST /api/jobs/videos/compose`.

### Step 1: Job Creation

`JobOrchestrator.create_job(...)` creates the job row and generates a persisted job name.

### Step 2: Script Persistence

The source text is stored as a completed `new_text_prompt` event.

### Step 3: Speech Generation

Speech is scheduled as a `new_audio_prompt` event in `speech` mode.

When it completes:

- audio duration is extracted via `ffprobe`
- instrumental audio is scheduled
- clip count is calculated from audio duration and job settings

### Step 4: Scene Generation

`PromptGenerator.image_scene_prompts(...)` asks LM Studio for a chronological list of scene prompts.

Each scene is scheduled as an indexed `new_image_prompt` event.

### Step 5: Video Generation

When an indexed image completes:

- asset metadata is persisted
- LM Studio generates a video prompt from the image
- an indexed `new_video_prompt` event is scheduled

The video event inherits the source image `index`.

### Step 6: Transition Generation

When all indexed video events are complete:

- completed clips are sorted by `index`
- adjacent clip pairs are used to extract first/last frames
- LM Studio generates transition prompts
- indexed `new_transition_prompt` events are scheduled

Transition `index` represents the gap between clip `n` and clip `n + 1`.

### Step 7: Final Composition

`VideoGenerator.combine_outputs(...)`:

- reads complete video events
- reads complete transition events
- sorts both by `index`
- interleaves them as `video0, transition0, video1, transition1, ...`
- writes an ffmpeg concat file
- produces a final `new_video_composition` event and matching `meta` row

## Job Lifecycle and Recovery

On startup the app runs:

- `DB.Jobs.failBrokenJobs()`
- `DB.Jobs.finalizeCompletedJobs()`
- `QueueManager.resume()`

This handles:

- failing active jobs that still have pending/running work from a previous process state
- marking settled active jobs terminal
- requeueing any remaining running events back to `pending`

Job finalization rules:

- if an active job has no pending/running events left and any event failed, mark job `failed`
- if an active job has no pending/running events left and no event failed, mark job `complete`

Cancellation is supported via `POST /api/jobs/:job_id/cancel`.

Cancelled jobs:

- interrupt running ComfyUI work when possible
- delete queued ComfyUI prompts when possible
- mark pending/running local events as failed with cancel context
- preserve job lifecycle as `cancelled`

## Realtime UI

The UI is server-rendered and uses HTMX for interactions.

### Technologies

- HTMX
- HTMX SSE extension
- DaisyUI
- Tailwind CSS via CDN
- Hono JSX SSR

### Update Model

The app uses SSE as a lightweight notification bus.

Pattern:

1. server publishes `job-update` for a specific job
2. browser receives SSE message
3. HTMX re-fetches the relevant progress fragment over normal HTTP
4. server returns fresh HTML fragment

This keeps the UI HTML-driven without polling.

## Key Directories

```text
src/
  api/          HTTP routes and SSR route groups
  audio/        speech and instrumental scheduling
  comfyui/      ComfyUI client and workflow templates
  db/           schema, queries, migrations, gallery listing
  events/       typed event definitions and emitter
  image/        image scheduling and generation
  jobs/         job orchestration and task creation
  llm/          LM Studio wrapper
  meta/         metadata helpers such as audio duration
  prompts/      scene, image, video, and job-name generation
  queue/        DB-backed single-slot queue manager
  socket/       ComfyUI websocket listener and completion handling
  sse/          SSE job update publisher/stream
  templates/    JSX templates and HTMX fragments
  text/         text/script event helpers
  video/        video scheduling, transitions, and final composition
```

## Main Routes

### Pages

- `GET /` dashboard
- `GET /compose` compose page
- `GET /create/*` image creation page
- `GET /gallery` gallery page
- `GET /jobs` jobs page
- `GET /jobs/details/:jobId` selected job view

### Job APIs

- `GET /api/health`
- `POST /api/jobs/videos/compose`
- `POST /api/jobs/images`
- `POST /api/jobs/:job_id/cancel`
- `DELETE /api/jobs/:job_id`

### HTMX / Fragment Routes

- `GET /jobs/events`
- `GET /jobs/generated-images`
- `GET /jobs/compose-progress`
- `GET /jobs/image-progress`
- `GET /jobs/generated-images-card`
- `GET /api/fragments/job-action-modal`

### SSE

- `GET /jobs/stream?job_id=...`

## Data Ordering Rules

This codebase has two different valid event orderings depending on use case.

### Chronological Ordering

Use chronological ordering for UI timelines and status views.

Reader:

- `DB.Events.findByJobIdChronological(jobId)`

### Sequencing Ordering

Use index-aware ordering for compose media sequencing.

Reader:

- `DB.Events.findByJobId(jobId)`

This is important because compose image prompts are created in parallel, so `created_at` alone does not preserve scene chronology.

## Local Development

### Prerequisites

- Bun
- ComfyUI
- LM Studio with the configured model loaded
- ffmpeg and ffprobe

### Environment

Expected environment variables include:

```bash
COMFYUI_BASE_URL=http://localhost:8188
COMFYUI_BASE_WS=ws://localhost:8188
OUTPUT_DIR=/path/to/comfy/output
INPUT_DIR=/path/to/comfy/input
```

### Install and Run

```bash
bun install
bun db:migrate
bun start:hot
```

### Useful Checks

```bash
bunx tsc --noEmit
sqlite3 silicon-seeds.sqlite ".tables"
```

## Notes on Current Implementation

- timestamps are now persisted from the application with millisecond precision for new rows
- job progress/event timelines use chronological event reads
- compose sequencing uses indexed media reads
- gallery infinite scroll uses a grid layout so appended items appear left-to-right
- several templates still build `/assets/...` paths inline instead of using one shared helper

## License

UNLICENSED - Private project
