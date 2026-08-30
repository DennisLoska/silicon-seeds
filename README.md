# Silicon Seeds

> **License:** GPL-3.0-or-later — see [LICENSE](LICENSE). Any derivative or service that includes this code must remain open source under the same license.

Local generative media studio. Orchestrates LM Studio (text), ComfyUI (image/video/audio), SQLite (jobs) and a SolidJS + DaisyUI frontend to produce images, videos and composed films from scripts.

## Prerequisites

- **Bun** ≥1.3 (`curl -fsSL https://bun.sh/install | bash`)
- **ComfyUI** running locally (default `http://127.0.0.1:8188`)
- **LM Studio** with API server enabled (default `http://127.0.0.1:1234`) and models loaded
- **ffmpeg + ffprobe** (`sudo pacman -S ffmpeg` / `brew install ffmpeg`)
- **Voicebox** (optional, for TTS in Compose) — default `http://127.0.0.1:17493`
- **ChromaDB** (optional, for gallery search) — default `http://127.0.0.1:8000`
- **SearXNG** (optional, for LLM web search via MCP) — default `http://localhost:8888`

## Service dependencies

| Service | Default URL | Required | What it does |
|---------|-------------|----------|--------------|
| ComfyUI | `http://127.0.0.1:8188` | yes | Image (Z-Image-Turbo), video (Wan 2.2 / LTX 2.3), audio generation |
| LM Studio | `http://127.0.0.1:1234` | yes | LLM text, scene prompts, style expansion, job naming |
| Voicebox | `http://127.0.0.1:17493` | for Compose | TTS for script → speech |
| ChromaDB | `http://127.0.0.1:8000` | no | Vector search for gallery |
| SearXNG | `http://localhost:8888` | no | `searxng_web_search` tool for LLM via `mcp-searxng` |

If Voicebox/Chroma/SearXNG are not running, the app still starts — related features just fail at runtime with a clear error.

## Environment variables

Copy `.env.example` to `.env` and edit paths. All vars are read via `Bun.env`.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COMFYUI_BASE_URL` | yes | `http://127.0.0.1:8188` | ComfyUI HTTP API |
| `COMFYUI_BASE_WS` | yes | `ws://127.0.0.1:8188` | ComfyUI WebSocket for queue events |
| `OUTPUT_DIR` | yes | — | ComfyUI `output` dir (where Comfy writes images/videos) |
| `INPUT_DIR` | yes | — | ComfyUI `input` dir (where app stages uploads) |
| `CONTENT_LIBRARY_DIR` | yes | — | Persistent gallery dir (e.g. `~/content_library`) |
| `LLM_MODEL` | yes | — | LM Studio model id, e.g. `qwen3.6-35b-a3b` |
| `EMBEDDING_MODEL` | yes | — | LM Studio embedding model, e.g. `text-embedding-qwen3-embedding-8b` |
| `VOICEBOX_URL` | no | `http://127.0.0.1:17493` | Voicebox TTS server |
| `CHROMADB_HOST` | no | `127.0.0.1` | Chroma host |
| `CHROMADB_PORT` | no | `8000` | Chroma port |
| `LOG_LEVEL` | no | `info` | `debug`/`info`/`warn`/`error` |
| `NODE_ENV` | no | `development` | `development` / `production` |

Example `.env`:

```bash
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_BASE_WS=ws://127.0.0.1:8188
OUTPUT_DIR=/path/to/comfy-ui/output
INPUT_DIR=/path/to/comfy-ui/input
CONTENT_LIBRARY_DIR=/home/you/content_library
LLM_MODEL=qwen3.6-35b-a3b
EMBEDDING_MODEL=text-embedding-qwen3-embedding-8b
VOICEBOX_URL=http://127.0.0.1:17493
CHROMADB_HOST=127.0.0.1
CHROMADB_PORT=8000
LOG_LEVEL=info
```

## Installation

```bash
git clone https://github.com/DennisLoska/silicon-seeds.git
cd silicon-seeds
bun install
cp .env.example .env   # edit paths above
bun run db:migrate      # creates silicon-seeds.sqlite + style presets/loras tables
bun run build:css       # builds static/style.css from src/client/index.css
```

Validate setup:

```bash
bunx tsc --noEmit
curl http://127.0.0.1:8188/system_stats  # ComfyUI
curl http://127.0.0.1:1234/v1/models     # LM Studio API
curl http://127.0.0.1:17493/profiles     # Voicebox (if used)
```

## Running

```bash
# backend + frontend (hot reload)
bun run start:hot
# or without hot reload
bun run start
```

- Frontend (Vite dev, proxied): `http://127.0.0.1:5174` → API at `3000`
- Backend (Hono): `http://127.0.0.1:3000`
- Health: `curl http://localhost:3000/api/health` → `{"status":"up"}`

Production build (serves SPA from `dist/client`):

```bash
npx vite build          # → dist/client
npx @tailwindcss/cli -i src/client/index.css -o static/style.css
bun run start           # serves http://localhost:3000
```

Useful commands:

```bash
bunx tsc --noEmit
bun run lint
bun run db:rollback      # last migration
bun run db:chroma        # start local Chroma at content_library/chroma-data
```

## First run

1. Open `http://localhost:3000` → `Jobs`.
2. Go to `Settings` → `Sync from ComfyUI` to import LoRAs, edit `Defaults` (fps, resolution, preset) and `Style Presets` (from `mflux-forge`).
3. **Image:** `Create → Image` → prompt + style preset + optional LoRAs (drag to reorder, 0.1-2.0) → `Generate`.
4. **Compose:** `Create → Compose` → script or `.txt` + style guide + voice → `Generate Video`. Pipeline: speech → scenes → images → videos → transitions → concat.
5. **Gallery / Jobs:** track progress via SSE, view media, cancel or regenerate failed events.

API quick test:

```bash
curl -X POST http://localhost:3000/api/jobs/images \
  -F "prompt=a watercolor alpine lake" \
  -F "image_model=z-image-turbo" \
  -F "style_preset=watercolor" \
  -F "resolution=720p"
```

## Troubleshooting

- **ComfyUI not reachable** → check `COMFYUI_BASE_URL`/`WS`, `curl /system_stats`, ensure ComfyUI started with `--listen`.
- **LLM_MODEL missing** → `LLM_MODEL variable missing` at startup — set in `.env` and load model in LM Studio with API server on.
- **OUTPUT_DIR/INPUT_DIR wrong** → images not found, `Bun.file` errors — must be absolute paths to ComfyUI dirs.
- **Voicebox 8000 vs 17493** → default is now `17493`; set `VOICEBOX_URL` if yours differs.
- **Queue stuck at audio** → audio is single-threaded (`hasRunning` gate). Check `voicebox` logs, `GET /history` in ComfyUI, or `SELECT * FROM events WHERE status='running'`.
- **Styles not appearing** → `POST /api/style-presets` requires DB; run `bun run db:migrate` and check `Settings`.

## Project layout

```
src/
  api/        Hono routes (jobs, settings, loras, comfyui)
  client/     SolidJS SPA + DaisyUI (Compose, CreateImage, Settings, Jobs)
  comfyui/    ComfyUI client + workflow JSON
  db/         Kysely + SQLite migrations
  llm/        LM Studio + MCP (SearXNG)
  queue/      single-slot DB queue (prio 300 audio > 200 image > 100 video)
  tts/        Voicebox client
  styles/     style presets (from mflux-forge)
```

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
