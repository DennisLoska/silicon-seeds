# HyperCut: AI-Assisted Video Timeline Editor

## Overview

HyperCut is a new `/create/hypercut` page that lets users upload a source video, get a WhisperX transcription, autocut filler words/pauses/mistakes into suggested removal segments, receive AI-generated content suggestions from ChromaDB, and build a final cut by manually selecting which suggestions to place on a video timeline rendered with Hyperframes Studio.

Important: HyperCut is **decoupled from the existing AutoCut feature**. It has its own transcript analysis and its own timeline logic, even though the removal-detection concept is inspired by AutoCut.

The UI shell uses the existing HTMX/DaisyUI server-rendered pattern. The interactive timeline is embedded as a React island that loads Hyperframes Studio. Suggestion panels, transcript markers, upload forms, and job status remain HTMX fragments so they can update via SSE and reuse existing components.

## Success Criteria

- [ ] User can upload a video from `/create/hypercut`
- [ ] WhisperX generates a transcript with per-word timestamps
- [ ] ChromaDB semantic search returns relevant images/videos from the content library for transcript segments
- [ ] Suggestions are shown in a DaisyUI panel; user decides which to add to the timeline
- [ ] Autocut suggestions (filler words, pauses, mistakes) are shown as dedicated removal snippets on the timeline, highlighted for review
- [ ] Timeline state (clips, start/end times, tracks) is persisted in SQLite
- [ ] User can render the final composition by calling MCP-video Hyperframes tools
- [ ] Final rendered video is available in the job's Media tab via `/assets/`
- [ ] SSE updates show transcription, suggestion, and render progress

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Browser: /create/hypercut                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │ HTMX/DaisyUI shell (nav, forms, status, SSE)                           ││
│  │ ┌──────────────┐  ┌─────────────────────────────┐  ┌─────────────────┐││
│  │ │ Upload Form  │  │  React Island:              │  │ Suggestions     │││
│  │ │ + settings   │  │  Hyperframes Studio         │  │ Panel (HTMX)    │││
│  │ │              │  │  - video track              │  │ - images/videos │││
│  │ │              │  │  - placed clips             │  │ - future texts  │││
│  │ │              │  │  - transcript markers       │  │ - drag/drop     │││
│  │ └──────────────┘  └─────────────────────────────┘  └─────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bun Backend (Hono)                                                         │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ POST /api/jobs│  │ WhisperX     │  │ ChromaDB     │  │ MCP-video      │  │
│  │ /hypercut     │──│  → transcript│──│  → search    │──│  MCP server    │  │
│  │               │  │    JSON      │  │  suggestions │  │  (subprocess)  │  │
│  └───────────────┘  └──────────────┘  └──────────────┘  └────────────────┘  │
│         │                                            │                        │
│         ▼                                            ▼                        │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │ SQLite: jobs, events, hypercut_clips, hypercut_suggestions          │     │
│  └────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Design Decisions

### User-driven timeline

The timeline is user-driven. AI only produces suggestions. The user explicitly selects which content suggestions and which autocut removals to apply. Nothing is auto-placed on the timeline.

### Autocut suggestions as dedicated timeline snippets

HyperCut runs its own transcript analysis (in `src/hypercut/`, not reusing `src/autocut/`) to detect:
- Filler words (`um`, `uh`, `ah`, etc.)
- Long pauses
- Obvious restarts/mistakes

Each detected segment becomes a `hypercut_suggestions` row with `source_type=autocut_cut` and is shown on the timeline as a highlighted removal snippet. The user can keep, shorten, or delete each snippet. Removed segments are excluded from the final render.

### HTMX shell + React island for Hyperframes Studio

We keep the existing server-rendered HTMX/DaisyUI pattern for everything except the interactive timeline. Hyperframes Studio is loaded as a React island inside the page. The island receives:

- Source video URL
- Transcript segments with timestamps
- Initial timeline clips (from accepted suggestions)
- Hyperframes project configuration

The island emits events when the user changes the timeline (add/move/resize clips). These events are posted to HTMX-backed endpoints that persist the changes.

### MCP-video integration

MCP-video runs as a subprocess MCP server, following the same pattern as the existing SearXNG MCP server (`bun run mcp-*`). The Bun backend spawns it with `StdioClientTransport`.

For the MVP we use MCP-video for:
- Hyperframes project scaffolding and rendering (`hyperframes_init`, `hyperframes_render`)
- FFmpeg post-processing if needed (`trim`, `merge`, `subtitles`)

WhisperX transcription continues to use the local `src/whisperx/whisperx.ts` wrapper.

### HyperCut transcript analysis

After WhisperX produces a transcript, HyperCut runs its own analysis. This is separate from the existing `src/autocut/` workflow.

1. Build timed words from WhisperX JSON
2. Detect filler words, pauses, and restart/mistake spans via local rules + optional LLM pass
3. Store each detected span as `source_type=autocut_cut` in `hypercut_suggestions`

### Content suggestions from ChromaDB

After transcript analysis, we:

1. Split transcript into segments (sentences or fixed windows)
2. Generate a short search query per segment (LLM summary of the visual concept)
3. Query ChromaDB for semantically similar images/videos from the content library
4. Score and deduplicate suggestions
5. Store suggestions in `hypercut_suggestions` with `transcript_anchor_start`/`transcript_anchor_end`

Future extension: `text` suggestions from book quotes will reuse the same table by adding a `text_content` column and `source_type` value.

## Data Model Additions

### `hypercut_suggestions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | string PK | UUID |
| `job_id` | string FK | → jobs.id |
| `source_type` | enum | `image`, `video`, `text`, `autocut_cut` |
| `asset_id` | string? | → meta.id for images/videos |
| `text_content` | string? | For future text/quote suggestions |
| `transcript_anchor_start` | number | Seconds in source video |
| `transcript_anchor_end` | number | Seconds in source video |
| `score` | number | ChromaDB distance/score |
| `status` | enum | `pending`, `accepted`, `rejected` |
| `created_at` | datetime | |

### `hypercut_clips`

| Column | Type | Notes |
|--------|------|-------|
| `id` | string PK | UUID |
| `job_id` | string FK | → jobs.id |
| `suggestion_id` | string? | FK → hypercut_suggestions.id |
| `start_time` | number | Timeline start in seconds |
| `end_time` | number | Timeline end in seconds |
| `track` | number | Vertical track index |
| `layer_data` | JSON | Hyperframes-specific layer config |
| `created_at` | datetime | |

## New Files

- `src/templates/hypercut.tsx` — HyperCut page shell and React island mount
- `src/templates/hypercut-suggestions.tsx` — HTMX fragment for suggestion cards
- `src/api/create/hypercut.tsx` — Page routes (`/create/hypercut`, status fragments)
- `src/api/api/hypercut.ts` — API routes (`POST /api/jobs/hypercut`, suggestion actions)
- `src/api/schemas.ts` — Add `PostHypercutSchema`
- `src/hypercut/hypercut-workflow.ts` — Orchestration: upload → transcribe → analyze cuts → search → render
- `src/hypercut/hypercut-transcript-analyzer.ts` — Filler/pause/mistake detection (no dependency on `src/autocut/`)
- `src/hypercut/hyperframes-island.tsx` — React component wrapping Hyperframes Studio
- `src/mcp/mcp-video.ts` — MCP-video subprocess client wrapper
- `src/db/db.ts` — Add `hypercut_suggestions` and `hypercut_clips` query helpers
- `src/main.ts` — Register `MCPVideo.init()`

## User Flow

1. User navigates to `/create/hypercut`
2. Uploads a video file and selects settings (resolution, model, suggestion count)
3. Server creates a job, runs WhisperX, stores transcript
4. Server runs HyperCut transcript analysis, stores autocut removal suggestions as highlighted timeline snippets
5. Server queries ChromaDB and stores content suggestions
6. HTMX fragment updates show both suggestion panels
7. User selects which autocut removals to keep and which content suggestions to add to the Hyperframes Studio timeline
8. User clicks "Render"; server calls MCP-video Hyperframes render
9. SSE updates show analysis, suggestion, and render progress
10. Final video appears in Media tab

## Error Handling

- If Hyperframes CLI is not installed, show a setup alert and disable render
- If MCP-video fails to spawn, fall back to local FFmpeg composition for MVP
- Failed suggestions are tracked with `status=failed` and do not block the UI
- Timeline validation errors are returned before render is attempted

## Future Extensions

- Text/quote suggestions from external book corpora
- Direct LLM scene generation from transcript anchors
- MCP-video powered repurposing exports (Shorts/Reels/TikTok)
- Collaborative timeline states
