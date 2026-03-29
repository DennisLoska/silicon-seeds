# Silicon-Seeds

Whoever has ears, let them hear.

A modular, event-driven generative media orchestration platform that creates videos by coordinating LLM-based content generation with ComfyUI workflows via a Hono + JSX web application running on Bun.js.

## Overview

```
┌──────────┐    HTTP     ┌───────────────┐
│  Client  │───POST─────▶│  Hono Server  │
└──────────┘             └──────┬───────┬─┘
                                   │       │
                      WebSocket ▼       ▼ ComfyUI REST
                           ┌─────────┐  ┌──────────┐
                           │  LM Studio│  │  ComfyUI │
                           │ qwen3.5  │  │ Workflows│
                           └──────────┘  └──────────┘
                                   │
                              SQLite DB (Kysely)
                           ┌─────────────────────┐
                           │   Jobs, Events, Meta│
                           └─────────────────────┘

Client Stack:
- HTMX: Dynamic UI interactions via SSE/HTTP
- Daisy UI: React-like component library
- Tailwind CSS: Utility-first styling
```

## Architecture

Silicon-Seeds uses an event-driven architecture with four main components:

- **Hono Server**: Web framework handling API requests, SSR via JSX templates, and coordination of all generation pipelines
- **LLM (LM Studio)**: Text and image prompt generation via HTTP SDK (`qwen/qwen3.5-35b-a3b`)
- **ComfyUI**: Executes generation workflows for images, videos, audio via REST API
- **SQLite Database (Kysely ORM)**: Persists jobs, events, and metadata with type-safe queries

### Web Interface

The application features a server-side rendered web interface using:

- **Hono JSX Renderer**: Server-side component rendering with React-like syntax
- **Daisy UI**: Component library providing pre-styled UI elements (buttons, cards, navbar)
- **HTMX**: Dynamic client-side interactions without custom JavaScript
- **Tailwind CSS**: Utility classes for additional styling flexibility

### Pipeline Flow

```
Script Generation      Audio Generation       Image Generation        Video Generation
─────────────────     ───────────────────    ────────────────        ───────────────

   User Prompt              Script           ┌────────────────┐         ┌──────────────┐
       │                   (Text)            │  Z Image Turbo │         │   WAN 2.2    │
       ├─────────────────▶ Prompt Generator  │   (SD3.5)      │         │   i2v /      │
       │                   (LLM)             └────────┬─────────┘         │ transitions  │
       │                                              │                  │              │
       │                                              ▼                  ▼              ▼
       │                                         Image Queue        Video Queue
       │                                              │                  │
       │                                              ▼                  ▼
       │                                        Audio Queue      Transition Queue
       │                                              │
       └────────────────▶ Audio Scheduling ◀──────────┘
                               (Kokoro TTS / ACE Step)
```

## How It Works

### Main Video Composition Pipeline (`compose-video`)

1. **Database Initialization**
   ```
   JobOrchestrator.create_job()
     → DB.Jobs.create_job()
       → SQLite INSERT INTO jobs (id, created_at)
         → Returns job record with UUID
   ```

2. **Script Generation** (Blocking)
   ```
   POST /api/jobs/videos/compose
     → TextGenerator.create_script(prompt)
       → LLM.message("Create essay: ...")
         → Returns ~800-1300 word essay
   ```

3. **Voiceover TTS** (Blocking)
   ```
   AudioGenerator.schedule_audio({prompt: script})
     → Kokoro TTS workflow executes
       → DB.Events.create() persists event with status=pending
         → Returns audio blob
   ```

4. **Duration Extraction & Music Queue**
   ```
   Metadata.getAudioDuration(audio_blob)
     → ffprobe extracts duration
       → ACE Step instrumental queued
         → Event tracked in database with status=pending
   ```

5. **Scene Prompts** (Non-blocking)
   ```
   PromptGenerator.image_scene_prompts(script, count)
     → LLM generates JSON array of scene descriptions
       → For each scene:
         → DB.Events.create() stores event for tracking
           → txt_to_img_prompt() → Image Generator
             → Z Image Turbo workflow
               → DB.Meta.create() stores file metadata
                 → Returns image files
   ```

6. **Video Generation** (Async)
   ```
   VideoGenerator.schedule_video({filename, prompt})
     → WAN 2.2 i2v workflow executes
       → DB.Events.updateStatus() marks event complete
         → Returns video file

   VideoGenerator.prepare_transitions()
     → FFmpeg extracts frames
       → LLM creates transition prompts
         → WAN 2.2 transitions queued and tracked in database
   ```

### Database Integration

The database persists all job lifecycle events:

- **Jobs Table**: Stores parent job records (id, created_at)
- **Events Table**: Tracks all generation events with:
  - `status`: pending | complete
  - `mode`: text | image | video | speech | instrumental
  - `type`: new_image_prompt | new_video_prompt | new_transition_prompt | new_audio_prompt
  - `prompt`: The generation prompt (if applicable)
  - `filename`, `start_img`, `end_img`: Asset references
  - `duration`, `lora`, `index`: Event-specific fields

- **Meta Table**: Stores file metadata:
  - `filename`: Output filename
  - `subfolder`: ComfyUI subfolder path
  - `type`: input | output | temp

Socket server (`socket-server.ts`) reads events from the database when workflows complete and updates status to "complete".

## Project Structure

```
src/
├── api/               # API endpoints and SSR routes
│   ├── jobs/         # Job orchestrators
│   │   ├── compose-video.ts
│   │   ├── script-to-scenes.ts
│   │   ├── text-to-*.ts
│   │   └── video-transition.ts
│   ├── health.ts     # Health check endpoint
│   ├── not_found.ts  # 404 handler
│   └── api.tsx       # Hono app with JSX routes
├── audio/            # Audio generation (TTS, instrumental)
├── comfyui/          # ComfyUI HTTP client + JSON workflows
│   ├── api/         # Workflow configs
│   └── workflows/   # Full workflow templates
├── db/               # Database layer (Kysely ORM)
│   ├── db.ts         # Database connection & schema types
│   ├── tables.ts     # TypeScript type definitions for tables
│   ├── migrate.ts    # Migration runner
│   └── rollback.ts   # Rollback handler
├── events/           # Event system (EventEmitter)
├── image/            # Image generation pipeline
├── jobs/             # Job tracking & management
├── llm/              # LM Studio SDK wrapper
├── logger/           # Logging utilities
├── meta/             # Metadata utilities
├── migrations/       # Database migrations (Kysely format)
├── prompts/          # Prompt generation layer
├── queue/            # Queue management
├── socket/           # ComfyUI WebSocket listener
├── styles/           # Visual style presets
├── templates/        # JSX server-side templates
├── text/             # Text/Script generation
└── video/            # Video generation pipeline
```

## Key Components

### Web Framework (`api/api.tsx`)
- **Hono**: Lightweight web framework with JSX rendering support
- **Routes**: Mixed API (JSON) and SSR (HTML) endpoints
- **Middleware**: Error handling, 404 fallback, request routing
- **JSX Templates**: Server-side component composition

### Database Layer (`db/db.ts`)
- **Kysely ORM**: Type-safe SQL queries with full TypeScript support
- **BunSQLite dialect**: Native Bun SQLite integration for高性能
- **Schema Types**: Compile-time type safety for all database operations
- **Three Tables**:
  - `jobs`: Stores job records (id, created_at)
  - `events`: Tracks generation events with status, mode, prompts, and assets
  - `meta`: Stores file metadata (filename, subfolder, type)

### Event System (`events/events.ts`)
- **Pub/Sub**: Node.js EventEmitter-based messaging
- **Event Types**:
  - `NewImagePrompt`: Schedule image generation
  - `NewVideoPrompt`: Schedule video from image
  - `NewTransitionPrompt`: Schedule video transitions
  - `NewAudioPrompt`: Schedule audio (TTS/instrumental)
  - `ComfyExecuted`: Workflow completion notification

### Queue Manager (`queue/queue-manager.ts`)
- **Three queues**: Image, Video, Audio with independent scheduling
- **Smart blocking** based on ComfyUI queue depth:
  - Audio: Max 3 concurrent jobs
  - Image: Blocks when ComfyUI queue > 0
  - Video: Waits for all images to complete

### ComfyUI Client (`comfyui/comfyui-client.ts`)
- HTTP client for `/prompt`, `/history`, `/queue`, `/view` endpoints
- **Workflow Types**:
  - `text-to-image`: Z Image Turbo (SD3.5, 720p)
  - `image-to-video`: WAN 2.2 (720p, 5s)
  - `image-to-transition`: WAN 2.2 transitions
  - `text-to-speech`: Kokoro TTS
  - `text-to-instrumental`: ACE Step

### Prompt Generator (`prompts/prompt-generator.ts`)
- Converts scripts to visual prompts via LLM
- **Methods**:
  - `txt_to_img_prompt()`: Single image prompt generation
  - `image_scene_prompts()`: Batch scene generation (JSON array)
  - `img_to_vid_prompt()`: Vision-based video prompt from images
- Supports style presets: watercolor, oil paint, mixed media, etc.

### Audio Generator (`audio/audio-generator.ts`)
- TTS via Kokoro workflow, instrumental via ACE Step
- Blocking `get_audio(id)` waits for completion (120s timeout)

## ComfyUI Workflows

| Kind                   | API Config                  | Model                      |
|------------------------|-----------------------------|----------------------------|
| text-to-image          | image_z_image_turbo_*.json  | Z Image Turbo (SD3.5)      |
| image-to-video         | video_wan2_2_14B_i2v_*.json | WAN 2.2 (720p, 5s)         |
| image-to-transition    | video_wan2_2_14B_trans.json | WAN 2.2 transitions        |
| text-to-speech         | kokoro-tts.json             | Kokoro TTS                 |
| text-to-instrumental   | audio_ace_step_*.json       | ACE Step                   |

Workflows stored as JSON and modified at runtime:
```typescript
api["57:27"].inputs.text = input.prompt;     // Inject prompt
api["17"].inputs.seconds = input.duration;   // Set duration
```

## Configuration

### Environment Variables (`.env`)
```bash
COMFYUI_BASE_URL=http://localhost:8188
OUTPUT_DIR=/path/to/comfyui/output
INPUT_DIR=/path/to/comfyui/input
```

### Prerequisites
- **Bun.js** runtime (v1.x+)
- **LM Studio** with `qwen/qwen3.5-35b-a3b` model loaded
- **ComfyUI** running on port 8188
- **FFmpeg/ffprobe** for audio duration and video frame extraction
- **SQLite** (built into Bun, no separate installation needed)

### Frontend Dependencies (CDN)
The web interface uses CDN-hosted libraries:
- **Daisy UI**: Component library via `cdn.jsdelivr.net`
- **HTMX**: Dynamic interactions via `unpkg.com`
- **Tailwind CSS**: Utility classes via `cdn.tailwindcss.com`

No build step required - templates render server-side and HTMX handles client-side updates.

### Database Setup
The project uses Kysely with SQLite migrations. The database is created automatically on first run.

```bash
bun install
bun db:migrate
bun src/main.ts
```

### Migrations

Database schema changes are managed via migration files in `migrations/`:

```bash
# Run pending migrations
bun db:migrate

# Rollback last migration (for development)
bun db:rollback
```

Migration file structure:
```typescript
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable("example").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("example").execute();
}
```

## API Endpoints

| Method | Endpoint                     | Description                              |
|--------|------------------------------|------------------------------------------|
| GET    | `/`                          | Main page (SSR via JSX)                  |
| GET    | `/api/jobs/list`             | Job list fragment (HTMX)                 |
| POST   | `/api/jobs/videos/compose`   | Compose complete video from script       |
| POST   | `/api/jobs/scenes`           | Generate scenes from text                |
| POST   | `/api/jobs/images`           | Generate images from prompts             |
| POST   | `/api/jobs/videos/transition`| Create video transitions                 |
| POST   | `/api/jobs/tts`              | Generate speech audio                    |
| POST   | `/api/jobs/instrumental`     | Generate instrumental music              |
| GET    | `/api/health`                | Health check (JSON)                      |

## Web Interface

The web interface uses server-side rendering with JSX and dynamic updates via HTMX:

- **Main Page**: Layout shell with navbar, job sidebar, and status regions
- **Job Sidebar**: HTMX-powered list that auto-updates from `/api/jobs/list`
- **Status Card**: Interactive health check with button-triggered refresh

Templates are located in `src/templates/`:
- `layout.tsx`: HTML wrapper with Daisy UI + Tailwind CDN setup
- `main-page.tsx`: Home page structure with HTMX-enabled regions
- `job-list.tsx`: Job list fragment for partial updates

## Current Status

**Active Features**:
- ✅ Script generation via LLM
- ✅ TTS audio generation (Kokoro)
- ✅ Instrumental generation (ACE Step)
- ✅ Image generation (Z Image Turbo)
- ✅ Video generation from images (WAN 2.2 i2v)
- ✅ Video transitions between clips
- ✅ Event-driven queue management
- ✅ SQLite database for job/event persistence
- ✅ Hono web framework with JSX server-side rendering
- ✅ Daisy UI component library for styling
- ✅ HTMX-powered dynamic UI updates

**Planned**:
- ⏳ User authentication (better-auth, JWT)
- ⏳ Content library with RAG vector search

## License

UNLICENSED - Private project
