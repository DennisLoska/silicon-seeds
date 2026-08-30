# Silicon-Seeds

> **License:** GPL-3.0-or-later — see [LICENSE](LICENSE).

Whoever has ears, let them hear.

Silicon-Seeds is a Bun-based generative media orchestration app that coordinates LM Studio, ComfyUI, SQLite, MCP tool calling, and a server-rendered HTMX UI to produce images, videos, speech, music, and AI-edited video.

## What It Does

The app supports four main interactive flows and several demo endpoints:

- **Compose**: create a full video from a script or uploaded text file (TTS → scenes → images → videos → transitions → composition)
- **AutoCut**: upload a video, transcribe with WhisperX, AI-analyze to remove filler/restarts/pauses, optionally insert AI-generated clips into the timeline
- **Image**: create standalone images from a text prompt
- **Audio/Song**: generate songs with configurable BPM, key/scale, instrumental, and lyrics
- **Demo endpoints**: standalone TTS, image-to-video, video-transition, instrumental, text-to-text, script-to-scenes

All job state and asset metadata are persisted in SQLite. Generated media files live on disk under configured ComfyUI directories. The UI updates via HTMX fragment fetches triggered by SSE notifications.

## Architecture

The runtime is centered around six systems:

- **Hono + JSX**: HTTP server, SSR templates, fragment endpoints
- **SQLite + Kysely**: durable jobs, events, asset metadata, and cut-clip tracking
- **LM Studio**: text generation, scene generation, video prompts, job naming, autocut planning, web search via MCP
- **ComfyUI**: image, video, transition, TTS, instrumental, and song generation
- **WhisperX**: external speech-to-text for transcription (AutoCut, scripting pipeline)
- **yt-dlp**: YouTube download (audio, video, with cookie support for restricted content)

### MCP Integration

MCP is embedded in the LLM client (`src/llm/llm.ts`). On startup it spawns a `bun run mcp-searxng` subprocess connected to a local SearXNG instance at `http://localhost:8888`. LM Studio can call the `searxng_web_search` tool to augment generation with web search results.

### Core Concepts

#### Jobs

Jobs are top-level units of work stored in the `jobs` table.

Each job has:
- `id` (UUID)
- `created_at`
- lifecycle `status`: `active | complete | failed | cancelled`
- `workflow`: `compose` | `autocut`
- render/model settings: `fps`, `clip_duration`, `transition_duration`, `resolution`, `image_model`, `video_model`, `style_preset`
- generated `name`, optional `original_prompt`

#### Events

Events are the durable queue and execution log for all work in the `events` table.

Each event has:
- execution `status`: `pending | running | complete | failed`
- `type`: text, image, video, transition, audio, composition
- `mode`: text, image, video, speech, instrumental, song
- optional `index` for ordered media in compose mode
- `priority` for queue selection
- `claimed_at`, `attempt_count`, `error`

Compose ordering is driven by `index`, not by insertion order.

#### Meta

The `meta` table stores generated asset locations:
- `filename`, `subfolder`
- `type`: `input | output | temp`

Maps events back to real images, videos, and audio files produced by ComfyUI.

#### AutoCut Clips

The `autocut_cut_clips` table stores each removed segment:
- `clip_index`, `start_seconds`, `end_seconds`, `duration_seconds`
- `reasons` (JSON array of why this segment was cut)
- `transcript_text` (the spoken words in the removed segment)
- `filename`, `subfolder`

## Queue Model

The queue is DB-backed, not in-memory.

Properties:
- only one media generation runs globally at a time
- queue selection from SQLite
- priority enforced at event level

Priority ordering:
- audio: `300`
- image: `200`
- video and transition: `100`

Queue selection: pending active-job events ordered by `priority desc`, then `index asc`, then `created_at asc`. This keeps compose media deterministic while preserving global media priority.

## Compose Pipeline

Starts at `POST /api/jobs/videos/compose`.

### Step 1: Job Creation
`JobOrchestrator.create_job(...)` creates the job row and generates a persisted job name.

### Step 2: Script Persistence
Source text stored as a completed `new_text_prompt` event.

### Step 3: Speech Generation
Scheduled as `new_audio_prompt` in `speech` mode. On completion: audio duration extracted via `ffprobe`, instrumental audio scheduled, clip count calculated.

### Step 4: Scene Generation
`PromptGenerator.image_scene_prompts(...)` asks LM Studio for a chronological list of scene prompts. Each scheduled as indexed `new_image_prompt`.

### Step 5: Video Generation
When an indexed image completes: asset metadata persisted, LM Studio generates a video prompt from the image, indexed `new_video_prompt` scheduled (inherits source image index).

### Step 6: Transition Generation
When all indexed videos complete: completed clips sorted by index, adjacent pairs extract first/last frames, LM Studio generates transition prompts, indexed `new_transition_prompt` events scheduled. Transition `index` represents the gap between clip `n` and `n + 1`.

### Step 7: Final Composition
`VideoGenerator.combine_outputs(...)`: reads complete video/transition events, sorts by index, interleaves as `video0, transition0, video1, transition1, ...`, writes ffmpeg concat file, produces `new_video_composition` event + `meta` row.

## AutoCut Pipeline

Starts at `POST /api/jobs/videos/autocut`.

### Step 1: Upload & Enqueue
Video uploaded via multipart form. Saved to `/tmp/silicon-seeds-autocut/<jobId>/`. Job created with `workflow="autocut"`. Manifest and status JSON written.

### Step 2: Transcribe
WhisperX runs on input video producing word-level timestamps (JSON segments with start, end, text, and per-word details).

### Step 3: Analyze
- `detectSilenceSpans()` identifies gaps >0.8s
- `PromptGenerator.autocut_plan_from_whisperx_json()` uses LLM to identify filler words, restarts, mistakes
- Results merged and de-duplicated

### Step 4: Cut Clips
`materializeCutClips()` trims each removed span with ffmpeg, saves to `OUTPUT_DIR/autocut/cut-clips/`, persists to `autocut_cut_clips` table.

### Step 5a: Simple Cut (no inserts)
`renderAutocutVideo()` concatenates all keep-spans via ffmpeg filter complex.

### Step 5b: With AI Inserts
`PromptGenerator.autocut_insertions_from_whisperx_json()` decides insertion points. For each: image generated → video from that image → `renderTimelineComposition()` builds complex timeline with xfade transitions between source segments and AI clips.

## Song Generation Pipeline

Starts at `POST /api/jobs/audio`.

The `AudioGenerator` creates a `NewAudioPrompt` event with `mode: "song"`. Configurable settings:
- `bpm`, `cfg_scale`, `temperature`, `top_p`
- `keyscale` (e.g. "C major"), `timesignature` (e.g. "4/4")
- `lyrics` (text) and `instrumental_only` flag

Dispatched to ComfyUI using ACE or Stable Audio workflows depending on generation type.

## Job Lifecycle and Recovery

On startup the app runs:
- `DB.Jobs.failBrokenJobs()` — fail active jobs with pending/running work from a previous process state
- `DB.Jobs.finalizeCompletedJobs()` — mark settled active jobs terminal
- `QueueManager.resume()` — requeue running events back to pending
- `QueueManager.pump()` — kick off initial queue processing

Job finalization:
- active job with no pending/running events → `failed` if any event failed, `complete` otherwise

Cancellation via `POST /api/jobs/:job_id/cancel`:
- interrupts running ComfyUI work
- deletes queued ComfyUI prompts
- marks pending/running events as failed with cancel context
- preserves job lifecycle as `cancelled`

Regeneration via `POST /api/jobs/:job_id/events/:event_id/regenerate`:
- resets a failed event back to `pending`
- allows retrying specific failed steps without restarting the entire job

## Realtime UI

Server-rendered HTMX-based UI.

### Technologies
- HTMX + HTMX SSE extension
- DaisyUI v5
- Tailwind CSS v4 via CLI build
- typed-htmx for type-safe HTMX attributes
- Hono JSX SSR
- Zod for request validation

### Update Model
SSE as lightweight notification bus:
1. server publishes `job-update` for a specific job
2. browser receives SSE message
3. HTMX re-fetches progress fragment over HTTP
4. server returns fresh HTML fragment

### Pages
- `/` or `/dashboard` — dashboard overview
- `/compose` — compose a video from script
- `/create/image` — create standalone images
- `/create/audio` — create songs with lyrics + instrumental
- `/create/autocut` — upload video for AI editing
- `/settings` — app settings
- `/gallery` — browse generated media
- `/jobs` — all jobs with filtering and detail view

## Key Directories

```text
src/
  api/          HTTP routes and SSR route groups
  audio/        speech, instrumental, and song scheduling via ComfyUI
  autocut/      AI video editing pipeline (transcribe → analyze → cut → optional inserts)
  comfyui/      ComfyUI client and workflow templates
  db/           schema, queries, migrations, gallery listing
  events/       typed event definitions and emitter
  image/        image scheduling and generation
  jobs/         job orchestration and task creation
  llm/          LM Studio wrapper + MCP client (SearXNG web search)
  logger/       structured logging via Logtape with pretty console sink
  meta/         metadata helpers such as audio duration
  prompts/      scene, image, video, autocut, and job-name generation
  queue/        DB-backed single-slot queue manager
  script/       experimental WIP pipeline (YouTube → transcribe → LLM score → trim)
  socket/       ComfyUI WebSocket listener and completion handling
  sse/          SSE job update publisher/stream
  styles/       art style definitions, presets, prompt generation
  templates/    JSX templates and HTMX fragments
  text/         text/script event helpers
  utils/        shared utilities
  video/        video scheduling, transitions, and final composition
  whisperx/     external WhisperX CLI transcription wrapper
  yt/           YouTube download via yt-dlp
```

## Main Routes

### Pages

- `GET /` dashboard
- `GET /dashboard` dashboard
- `GET /compose` compose page
- `GET /create/image` image creation
- `GET /create/audio` audio/song creation
- `GET /create/autocut` autocut upload
- `GET /settings` settings
- `GET /gallery` gallery
- `GET /jobs` jobs list
- `GET /jobs/details/:jobId` selected job detail view

### Job APIs

- `GET /api/health`
- `POST /api/jobs/videos/compose` — full compose pipeline
- `POST /api/jobs/videos/autocut` — AutoCut pipeline
- `POST /api/jobs/videos/transition` — transition demo (hardcoded)
- `POST /api/jobs/images` — standalone image generation
- `POST /api/jobs/audio` — song generation (instrumental + optional lyrics)
- `POST /api/jobs/tts` — TTS demo (hardcoded)
- `POST /api/jobs/instrumental` — instrumental demo (hardcoded)
- `POST /api/jobs/scenes` — script-to-scenes demo (hardcoded)
- `POST /api/jobs/videos` — image-to-video demo (hardcoded)
- `POST /api/jobs/:job_id/cancel` — cancel job
- `DELETE /api/jobs/:job_id` — delete job
- `POST /api/jobs/:job_id/events/:event_id/regenerate` — retry failed event

### HTMX Fragment Routes

- `GET /jobs/events`
- `GET /jobs/generated-images`
- `GET /jobs/generated-images-card`
- `GET /jobs/compose-progress`
- `GET /jobs/image-progress`
- `GET /api/fragments/job-action-modal`

### SSE

- `GET /jobs/stream?job_id=...`

## Data Ordering Rules

Two valid event orderings depending on use case.

### Chronological Ordering
For UI timelines and status views. Reader: `DB.Events.findByJobIdChronological(jobId)`.

### Sequencing Ordering
Index-aware ordering for compose media sequencing. Reader: `DB.Events.findByJobId(jobId)`.

Important: compose image prompts are created in parallel, so `created_at` alone does not preserve scene chronology.

## Local Development

### Prerequisites

- Bun
- ComfyUI (for image/video/audio generation)
- LM Studio with configured model(s) loaded (for text/prompt generation)
- ffmpeg and ffprobe
- WhisperX CLI (for autocut transcription)
- yt-dlp (for YouTube downloads, optional)
- SearXNG at localhost:8888 (for MCP web search, optional)

### Environment

```bash
COMFYUI_BASE_URL=http://localhost:8188
COMFYUI_BASE_WS=ws://localhost:8188
OUTPUT_DIR=/path/to/comfy/output
INPUT_DIR=/path/to/comfy/input
WHISPER_X=/path/to/whisperx
LOG_LEVEL=info
```

### Install and Run

```bash
bun install
bun db:migrate
bun run build:css    # build Tailwind CSS v4 styles
bun start:hot        # starts Bun with --hot reload
```

### Useful Checks

```bash
bunx tsc --noEmit
bun db:rollback
bun run lint
sqlite3 data.db ".tables"
```

### Style System

Styles are defined in `src/styles/`:
- `styles.ts` — art style enums (WATERCOLOR, GENERAL, MIXED) and texture maps
- `system.ts` — LLM prompt template that generates image generation instructions from StyleParams
- `presets.ts` — preset configurations (SYSTEM, WATERCOLOR, PENCIL_WATERCOLOR) with optional LoRA references

## Notes on Current Implementation

- timestamps persist from the application with millisecond precision for new rows
- job progress/event timelines use chronological event reads
- compose sequencing uses indexed media reads
- gallery infinite scroll uses grid layout so appended items appear left-to-right
- several templates still build `/assets/...` paths inline instead of using a shared helper
- autocut temp workspace lives in `/tmp/silicon-seeds-autocut/`
- script pipeline in `src/script/wip.ts` is experimental/WIP, not production-ready

## License

UNLICENSED — Private project
