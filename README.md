# Silicon-Seeds

Whoever has ears, let them hear.

A modular, event-driven generative media orchestration platform that creates videos by coordinating LLM-based content generation with ComfyUI workflows via a Bun.js server.

## Architecture Overview

Silicon-Seeds uses an **event-driven architecture** where the Bun server acts as the central orchestrator:
- **Bun Server**: Receives API requests, coordinates all components, passes prompts from LLM to ComfyUI
- **LLM (Qwen via LM Studio)**: Generates scripts and visual prompts via HTTP SDK
- **ComfyUI**: Executes image, video, audio, and instrumental generation workflows via REST API
- **Event System**: Pub/Sub messaging with Node.js EventEmitter coordinates all components

```
┌───────────────────────────────────────────────────────────────────────────────┐
║                    SILICON-SEEDS ARCHITECTURE OVERVIEW                        ║
╚═══════════════════════════════════════════════════════════════════════════════╝

                              ┌──────────────┐
                              │   Client     │
                              │  (Browser/   │
                              │   API)       │
                              └──────┬───────┘
                                     │ HTTP POST
                                     ▼
                        ┌──────────────────────────┐
                        │    BUN SERVER          │
                        │     main.ts            │
                        └──────────┬─────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  API LAYER        │   │ PROMPT LAYER      │   │ INFRASTRUCTURE    │
│                   │   │                   │   │                   │
│ compose-video.ts  │──▶│ PromptGenerator   │──▶│ EventSystem       │
│ script-to-scenes  │   │ - txt_to_img()    │   │ - EventEmitter    │
│ text-to-image     │   │ - image_scene()   │   │ - QueueManager    │
└───────────────────┘   └────────┬──────────┘   └────────┬──────────┘
                                 │                       │
                                 ▼                       │
                        ┌───────────────────┐            │
                        │     LLM           │◀───────────┼─▶ WebSocket
                        │  (LM Studio)      │            │   listener
                        │  qwen/qwen3-vl-  │            │
                        │    30b            │            │
                        └────────┬──────────┘            ▼
                                 │                       │
                                 │ HTTP SDK              │
                                 │                       │
                         ┌───────▼───────────────┐       │
                         │ BUN SERVER (HTTP)     │◀──────┘
                         │ comfyClient.generate()│
                         └──────────┬────────────┘
                                    │ HTTP POST /prompt
                                    ▼
                        ┌───────────────────────────┐
                        │    COMFYUI ENGINE        │
                        │                           │
                        │  • Z Image Turbo (SD3.5) │
                        │  • WAN 2.2 (video)       │
                        │  • Kokoro TTS            │
                        │  • ACE Step              │
                        └──────────┬────────────────┘
                                   │ HTTP GET /view
                                   ▼
                        ┌───────────────────────────┐
                        │    FILE STORAGE          │
                        │    (OUTPUT_DIR/INPUT_DIR)│
                        └───────────────────────────┘
```

## How It Works: compose-video() Job Flow

The main job orchestrates a complete video creation pipeline:

### Sequence Diagram

```
┌──────┐  ┌─────────────┐  ┌──────┐  ┌─────────────┐  ┌──────────┐
│Client│  │Bun Server   │  │ LLM  │  │ Bun Server  │  │ ComfyUI  │
└──┬───┘  └─────┬───────┘  └──┬───┘  └─────┬───────┘  └────┬─────┘
   │            │              │           │               │
   │ POST       │              │           │               │
   │ /compose   │              │           │               │
   ├───────────▶│              │           │               │
   │            │              │           │               │
   │            │ create_script()          │               │
   │            │◀─────────────┤           │               │
   │            │              │           │               │
   │            │ LLM.message  │           │               │
   │            ├─────────────▶│           │               │
   │            │              │           │               │
   │            │ script text  │           │               │
   │            │◀─────────────┤           │               │
   │            │              │           │               │
   │            │ schedule_audio(TTS)       │               │
   │            ├──────────────────────────▶│               │
   │            │              │           │               │
   │            │ (emit NewAudioPrompt)     │               │
   │            │              │           │               │
   │ get_audio  │              │           │               │
   │◀───────────┤              │           │               │
   │ audio blob │              │           │               │
   │            │              │           │               │
   │            │ getDuration()             │               │
   │            ├─────────────▶│           │               │
   │            │ duration     │           │               │
   │            │◀─────────────┤           │               │
   │            │              │           │               │
   │            │ schedule_audio(Instrumental)             │
   │            ├──────────────────────────▶│               │
   │            │              │           │               │
   │            │ image_scene_prompts()     │               │
   │            │ (fire & forget)           │               │
   │            ├──────────────────────────▶│               │
   │            │              │           │               │
   │            │ LLM.message(scene prompts)              │
   │            ├─────────────▶│           │               │
   │            │              │           │               │
   │            │ JSON array of scenes     │               │
   │            │◀─────────────┤           │               │
   │            │              │           │               │
   │            │ for each scene:          │               │
   │            │ txt_to_img_prompt()      │               │
   │            ├──────────────────────────▶│               │
   │            │              │           │               │
   │            │ LLM.message(image prompt)             │
   │            ├─────────────▶│           │               │
   │            │              │           │               │
   │ NewImagePrompt event     │           │               │
   │◀─────────────────────────┤           │               │
   │              (emit)       │           │               │
   │            │              │           │               │
   │            │ generate()   │           │               │
   │            ├──────────────────────────▶│               │
   │            │ POST /prompt             │               │
   │            │ {workflow + prompt}       │               │
   │            │              │           │               │
   │            │ ◀────────────┤execution_success│         │
   │            │              │           │               │
   │◀───────────┤              │           │               │
   │ {queued}   │              │           │               │
   │            │              │           │               │
```

### Step-by-Step Breakdown

1. **Script Generation** (Blocking)
   ```
   POST /api/jobs/videos/compose
     → PromptGenerator.txt_to_script(prompt)
       → LLM.message("Create essay: ")
         → Returns ~1000 word essay
   ```

2. **Voiceover TTS** (Blocking)
   ```
   AudioGenerator.schedule_audio({id, prompt: script})
     → Emits NewAudioPrompt event
       → ComfyUI Kokoro TTS workflow executes
         → Returns audio blob
   ```

3. **Duration Extraction & Music Queue**
   ```
   Metadata.getAudioDuration(audio_blob)
     → ffprobe extracts duration in seconds
       → AudioGenerator.schedule_audio({id, duration})
         → ACE Step instrumental workflow queued
   ```

4. **Scene Prompts Generation** (Non-blocking)
   ```
   PromptGenerator.image_scene_prompts(script, 40 scenes)
     → LLM.message("Generate JSON array of scene prompts...")
       → Returns ["scene1", "scene2", ...]
         → For each scene:
           → txt_to_img_prompt(scene_description)
             → LLM.message("Create image prompt: ")
               → Emits NewImagePrompt event
   ```

5. **Async Image Generation** (Parallel)
   ```
   EventSystem.NewImagePrompt
     → QueueManager.pop("image")
       → comfyClient.generate({kind: "text-to-image", prompt})
         → POST /prompt to ComfyUI
           → Z Image Turbo workflow executes
             → Returns image file paths
   ```

6. **Completion**
   ```
   All 40 images generated and stored in OUTPUT_DIR
   Ready for video assembly (FFmpeg integration planned)
   ```

## Project Structure

```
silicon-seeds/
├── src/
│   ├── api/                    # API entry points
│   │   └── jobs/              # Job orchestrators
│   │       ├── compose-video.ts
│   │       ├── script-to-scenes.ts
│   │       └── text-to-*.ts
│   ├── audio/                 # Audio generation pipeline
│   │   └── audio-generator.ts
│   ├── comfyui/               # ComfyUI HTTP client & configs
│   │   ├── comfyui-client.ts
│   │   ├── api/               # JSON workflow definitions
│   │   └── workflows/         # Extra PNG info workflows
│   ├── events/                # Event system
│   │   └── events.ts
│   ├── image/                 # Image generation pipeline
│   │   └── image-generator.ts
│   ├── llm/                   # LM Studio client wrapper
│   │   └── llm.ts
│   ├── meta/                  # Metadata utilities
│   │   └── meta.ts
│   ├── prompts/               # Prompt generation layer
│   │   └── prompt-generator.ts
│   ├── queue/                 # Queue management
│   │   └── queue-manager.ts
│   ├── socket/                # ComfyUI WebSocket listener
│   │   └── socket-server.ts
│   ├── styles/                # Visual style system
│   │   ├── presets.ts
│   │   ├── styles.ts
│   │   └── system.ts
│   └── video/                 # Video generation pipeline
│       └── video-generator.ts
├── package.json
└── README.md
```

## Key Components

### Event System (`events/events.ts`)
- Node.js EventEmitter-based pub/sub messaging
- Type-safe event emission via `Event.emit()` and subscriptions via `Event.on()`
- Defines job modes: Text, Image, Video, Speech, Instrumental
- Events: `NewImagePrompt`, `NewVideoPrompt`, `NewAudioPrompt`, `ComfyExecuted`

### Queue Manager (`queue/queue-manager.ts`)
- Three separate queues (image/video/audio) with smart blocking logic
- Prevents overloading ComfyUI GPU based on real-time queue depth:
  - Audio: allows up to 3 concurrent jobs
  - Image: blocks when comfyQueue > 0
  - Video: waits for all images and memory to be free
- Tracks completed events in `completed` array for retrieval by ID

### ComfyUI Client (`comfyui/comfyui-client.ts`)
- HTTP client wrapping ComfyUI REST API
- **generate(input)**: Submits workflows via POST /prompt
  - Injects prompts into pre-defined JSON workflow templates
  - Maps `kind` (text-to-image, image-to-video, etc.) to correct API config
  - Sets prompt_id and client_id for WebSocket event tracking
- **getAsset()**: Fetches generated content from GET /view endpoint
- **getImageOutput()**: Extracts output metadata from workflow history
- **freeMemory()**: Triggers VRAM cleanup via POST /free endpoint

### Prompt Generator (`prompts/prompt-generator.ts`)
- Converts text/scripts into visual prompts via LLM
- **txt_to_img_prompt**: Single image prompt generation
- **image_scene_prompts**: Batch scene generation from script (returns JSON array)
- **img_to_vid_prompt**: Vision-based video prompt from generated images
- Supports style presets (watercolor, oil paint, mixed media, etc.)

### Audio Generator (`audio/audio-generator.ts`)
- Handles both TTS and instrumental generation
- **schedule_audio()**: Creates `AudioPromptEvent`, emits via EventSystem
  - Speech mode: Uses Kokoro TTS workflow with prompt text
  - Instrumental mode: Uses ACE Step with duration parameter
- **get_audio(id)**: Blocks until `ComfyExecuted` event confirms completion (30s timeout)
- Routes to correct ComfyUI workflow based on audio type

### LLM Integration (`llm/llm.ts`)
- LM Studio SDK wrapper for local LLM inference
- Uses `qwen/qwen3-vl-30b` model (vision-capable)
- **message(prompt, images?)**: Text-only or multimodal queries
- Returns structured response with content field

## ComfyUI Workflows

| Kind                  | API Config File                | Model                    |
|-----------------------|--------------------------------|--------------------------|
| text-to-image         | `image_z_image_turbo_*.json`   | Z Image Turbo (SD3.5)    |
| image-to-video        | `video_wan2_2_14B_i2v_*.json`  | WAN 2.2 (720p, 5s)       |
| text-to-speech        | `kokoro-tts.json`              | Kokoro TTS               |
| text-to-instrumental  | `audio_ace_step_1_0_*.json`    | ACE Step                 |

Workflows are stored as raw JSON and modified at runtime:
```typescript
api["9.57:27"].inputs.text = input.prompt;  // Inject prompt
api["17"].inputs.seconds = input.duration;  // Set duration
```

## Running the Server

### Prerequisites
- **Bun.js** runtime (v1.x+)
- **LM Studio** with `qwen/qwen3-vl-30b` model loaded and server running
- **ComfyUI** running on port 8188
- **ffprobe** (part of FFmpeg) for audio duration extraction

### Environment Variables (.env)
```
COMFYUI_BASE_URL=http://localhost:8188
OUTPUT_DIR=/path/to/comfyui/output
INPUT_DIR=/path/to/comfyui/input
```

### Start Server
```bash
# Install dependencies
bun install

# Start server
bun src/main.ts
```

### API Endpoints

**POST /api/jobs/videos/compose**
```json
{
  "prompt": "The symbolism of baptism, creation, the void..."
}
// Returns: { message: "job queued" }
```

## Technical Notes

### Event Correlation Pattern
All tasks within a job chain share a `jobId` for correlation:
```typescript
const jobId = Metadata.randomId();      // Parent job ID
const ttsId = Metadata.randomId();      // Child task IDs
const instId = Metadata.randomId();     // Instrumental audio ID
```
This enables grouping related assets (future SQLite integration).

### Blocking vs Non-Blocking
```typescript
// Blocking - wait for completion
const ttsRes = await AudioGenerator.get_audio(ttsId);

// Non-blocking - fire and forget
void PromptGenerator.image_scene_prompts(...);
```

### Rate Limiting Logic
QueueManager implements smart blocking to prevent GPU overloading:
```typescript
// Audio: block if queue empty OR comfyQueue > 3
if (this.audioQueue.length === 0 || this.comfyQueue > 3) return;

// Image: block if queue empty OR comfyQueue > 0
if (this.imageQueue.length === 0 || this.comfyQueue > 0) return;

// Video: block if queue empty OR image queue has items OR comfyQueue > 0
if (this.videoQueue.length === 0 || 
    this.imageQueue.length > 0 || 
    this.comfyQueue > 0) return;
```

## License

UNLICENSED - Private project
