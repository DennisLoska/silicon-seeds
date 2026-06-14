# Batch Metadata Generator

Batch-process ComfyUI output images: copy to content library, generate LLM metadata (description, title, tags), save as `.stemn.metadata.json`.

## Design
- Read images from `OUTPUT_DIR` (ComfyUI output)
- Copy to `{CONTENT_LIBRARY_DIR}/image/`
- For each image: LLM description → title + tags in parallel → save metadata
- Batch 5 concurrent (configurable)
- Idempotent: skip if metadata exists, write image before metadata
- Pretty-printed JSON output
