# Video Content Pipeline - Architecture

## Overview

A backend system for LLM-driven video content creation that transforms video scripts into images and videos using local AI models. The pipeline parallelizes work across two GPUs: one for prompt generation and multimodal analysis via LM Studio (Qwen3-VL-30B), the other for image/video generation via ComfyUI.

The Qwen3-VL-30B model operates in two modes:
1. **Text-only mode** - Generates image prompts from script segments
2. **Multimodal mode** - Analyzes generated images with script context to derive video prompts

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (Bun/Express)                │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  ┌──────────┐         ┌──────────────┐      ┌──────────┐
  │ Scripts  │         │ Prompt       │      │ Queue    │
  │ Endpoint │         │ Generator    │      │ Manager  │
  └──────────┘         └──────────────┘      └──────────┘
                              │                      │
                    ┌─────────┴──────────┐          │
                    ▼                    ▼          ▼
              LM Studio             ComfyUI       Workers
               /     \                 |          / | \
          Prompt  Multimodal    Image/Audio/Video Img Audio Vid
           (Qwen3-VL)  (Qwen3-VL)
            text-only   multimodal
```

## Components

### 1. API Server (Bun + Express/Hono)

- RESTful endpoints for script management and job control
- WebSocket for real-time progress updates
- Serves as the orchestration layer

**Endpoints:**
- `POST /api/scripts` - Upload/create video scripts
- `GET /api/scripts/:id` - Get script details
- `POST /api/jobs` - Start a processing job
- `GET /api/jobs/:id/status` - Check job status
- `GET /api/assets` - List generated assets

### 2. Queue Manager

- Manages job queue with priorities
- Distributes work to appropriate workers
- Tracks dependencies between pipeline stages
- Supports batch processing (multiple scripts queued together)

### 3. Workers

**Prompt Worker (LM Studio - Qwen3-VL)**
- Calls LM Studio API to generate image prompts from script segments
- Uses text-only mode of Qwen3-VL for prompt generation
- Also estimates total video duration based on script content
- Configurable prompt templates for different video styles
- Handles rate limiting and retry logic

**Multimodal Analysis Worker (LM Studio - Qwen3-VL)**
- Analyzes generated images using LM Studio's multimodal API
- Sends base64-encoded images to Qwen3-VL-30B with script context
- Extracts video generation parameters from image analysis
- Returns structured JSON responses for video workflow

**Image Worker (ComfyUI)**
- Fetches pending image generation tasks
- Calls ComfyUI API to generate images from prompts
- Manages checkpoint/LoRA loading per batch

**Audio Worker (ComfyUI)**
- Generates background instrumental/music for the video
- Receives target duration from job's estimated length
- Calls ComfyUI audio generation API
- Supports style/tempo configuration based on video mood

**Video Worker (ComfyUI)**
- Uses ComfyUI's video synthesis nodes using Wan2.2 and LTX2
- Chains generated images into video sequences
- Combines with audio track from Audio Worker

### 4. Database (SQLite)

**Tables:**

```sql
-- Scripts store the raw input text
CREATE TABLE scripts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    duration_estimate INTEGER, -- seconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' -- pending, processing, completed, failed
);

-- Prompt generations from LM Studio
CREATE TABLE prompts (
    id TEXT PRIMARY KEY,
    script_id TEXT REFERENCES scripts(id),
    segment_index INTEGER, -- which part of the script
    prompt_text TEXT NOT NULL,
    negative_prompt TEXT,
    style TEXT, -- e.g., cinematic, animated, photorealistic
    model_used TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Generated assets (images, audio, and videos)
CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    script_id TEXT REFERENCES scripts(id),
    prompt_id TEXT REFERENCES prompts(id),
    type TEXT NOT NULL, -- 'image', 'audio', or 'video'
    file_path TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    duration_ms INTEGER, -- for audio and videos
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Processing jobs tracking the pipeline
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    script_id TEXT REFERENCES scripts(id),
    estimated_duration INTEGER, -- seconds, derived from script analysis
    status TEXT DEFAULT 'queued', -- queued, running, completed, failed
    progress REAL DEFAULT 0, -- 0-100
    error_message TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pipeline stage tracking for each job
CREATE TABLE job_stages (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id),
    stage TEXT NOT NULL, -- 'prompt', 'multimodal', 'image', 'audio', 'video'
    status TEXT DEFAULT 'pending',
    worker_id TEXT,
    started_at DATETIME,
    completed_at DATETIME
);

-- Image analysis results from Qwen3-VL multimodal processing
CREATE TABLE image_analyses (
    id TEXT PRIMARY KEY,
    script_id TEXT REFERENCES scripts(id),
    image_id TEXT NOT NULL,
    analysis_text TEXT NOT NULL,
    video_prompt TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Pipeline Flow

### Single Script Processing

1. **Script Upload** - User submits script via API
2. **Duration Estimation** - LM Studio analyzes script to estimate total video length (seconds)
3. **Job Creation** - System creates job with queued stages, including estimated duration
4. **Prompt Generation**
   - Script is split into segments (by scene/shot)
   - Prompt worker sends each segment to LM Studio
   - Generated prompts stored in `prompts` table
5. **Image Generation**
    - Image worker fetches pending prompts
    - Calls ComfyUI API for each prompt
    - Images saved locally, paths stored in `assets`
6. **Multimodal Analysis**
    - Multimodal worker uploads each image to LM Studio with script context
    - Qwen3-VL-30B analyzes images and suggests video transformation parameters
    - Video prompts stored in `image_analyses` table
7. **Audio Generation**
    - Audio worker receives estimated duration from job
    - Calls ComfyUI audio model to generate background instrumental
    - Passes target duration to ensure audio matches video length
8. **Video Generation**
   - Video worker chains images into sequences
   - Uses ComfyUI video nodes
   - Combines with generated audio track
   - Final video asset created

### Parallelization Strategy

```
Time ─────────────────────────────────────────────────────►

LM Studio: [Prompt A] [Multimodal A] [Prompt B] [Multimodal B]...
            │           │               │           │
ComfyUI:     ▼           ▼               ▼           ▼
          [Img][Audio][Vid]  [Img][Audio][Vid] ...
```

- **Prompt Worker** runs continuously using LM Studio (Qwen3-VL text-only mode)
- **Multimodal Worker** analyzes images with LM Studio (Qwen3-VL multimodal mode)
- **Image/Video/Audio Workers** run on ComfyUI with dependency-aware scheduling
- Multimodal analysis can run in parallel with image generation
- Video worker waits for analyzed images and audio to complete before final composition

## External API Integrations

### LM Studio

**Prompt Generation (Qwen3-VL text-only):**
```
POST http://localhost:1234/v1/chat/completions
```
- Model: Configurable (e.g., qwen/qwen3-vl-30b)
- Input: Script segment + system prompt with image generation instructions
- Output: JSON with prompts structured for ComfyUI

**Multimodal Analysis (Qwen3-VL with images):**
```
POST http://localhost:1234/v1/chat/completions
{
  "model": "qwen/qwen3-vl-30b",
  "messages": [{
    "role": "user",
    "content": [
      {"type": "text", "text": "Analyze this image for video generation..."},
      {
        "type": "image_url",
        "image_url": {"url": "data:image/png;base64,iVBORw0KGgo..."}
      }
    ]
  }],
  "response_format": {"type": "json_object"}
}
```
- Accepts base64-encoded images as data URLs
- Returns structured JSON with analysis results and video prompts

**Bun Example:**
```typescript
const response = await fetch("http://localhost:1234/v1/chat/completions", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({
    model: "qwen/qwen3-vl-30b",
    messages: [{
      role: "user",
      content: [
        {type: "text", text: promptText},
        {
          type: "image_url",
          image_url: {url: `data:image/${format};base64,${imageBase64}`}
        }
      ]
    }],
    response_format: {type: "json_object"}
  })
});
```

**Duration Estimation (Qwen3-VL text-only):**
```
POST http://localhost:1234/v1/chat/completions
```
- Input: Full script text with instruction to estimate video duration
- Output: Estimated duration in seconds based on word count, scene complexity

### ComfyUI

**Image Generation:**
```
POST http://localhost:8188/prompt
{
  "prompt": { "nodes": [...] },
  "workflow": "text-to-image"
}
```

**Video Generation:**
```
POST http://localhost:8188/prompt
{
  "prompt": { "nodes": [...image2video nodes...] }
}
```

**Audio Generation:**
```
POST http://localhost:8188/prompt
{
  "prompt": {
    "nodes": [
      { "id": 1, "type": "AudioGeneration", "inputs": { ... } },
      { "id": 2, "type": "DurationControl", "inputs": { "duration_seconds": <target> } }
    ]
  }
}
```
- Takes target duration from job's estimated length
- Generates background instrumental matching video mood/style

## Configuration

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "lmStudio": {
    "url": "http://localhost:1234",
    "model": "llama-3.1-8b",
    "qwen3vlModel": "qwen/qwen3-vl-30b",
    "maxTokens": 2048,
    "imageFormat": "base64-dataurl"
  },
  "comfyUI": {
    "url": "http://localhost:8188",
    "outputDir": "./outputs"
  },
  "queue": {
    "batchSize": 5,
    "pollIntervalMs": 1000
  }
}
```

## LLMs TXT Files

The `llms-full.txt` files serve purely as documentation references for the LM Studio and Bun HTTP APIs.

### LM Studio Model Catalog

- **Location:** https://lmstudio.ai/llms-full.txt
- Documents the OpenAI-compatible API endpoints supported by LM Studio
- Includes model identifiers, feature descriptions, and usage examples

### Bun LLMs Catalog

- **Location:** https://bun.sh/llms-full.txt
- Describes Bun's HTTP API for interacting with LLM providers (including LM Studio)
- Contains Bun-specific code examples for API calls using `fetch`

### Usage in This Project

These files document the HTTP APIs we implement:
1. **LM Studio API** - Reference for OpenAI-compatible endpoints (chat completions with image support)
2. **Bun API** - Reference for writing HTTP client code in Bun (`fetch`, `JSON.stringify`, etc.)

Example pattern from llms-full.txt references:
```typescript
// POST /v1/chat/completions to LM Studio via Bun's fetch API
const response = await fetch("http://localhost:1234/v1/chat/completions", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({
    model: "qwen/qwen3-vl-30b",
    messages: [{
      role: "user",
      content: [
        {type: "text", text: "Your prompt"},
        {
          type: "image_url",
          image_url: {url: `data:image/png;base64,${imageBase64}`}
        }
      ]
    }],
    response_format: {type: "json_object"}
  })
});
```

## Future Considerations

- Frontend webapp for script editing and preview
- Asset storage abstraction (local → S3/cloud)
