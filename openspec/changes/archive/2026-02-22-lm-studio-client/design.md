## Context

The video content pipeline uses LM Studio (Qwen3-VL-30B) for two operations:
1. **Prompt generation** - text-only mode to generate image prompts from script segments
2. **Multimodal analysis** - vision mode to analyze generated images and derive video prompts

Currently, these interactions use raw `fetch` calls scattered throughout the codebase. The architecture doc shows example patterns but they're not centralized or type-safe.

## Goals / Non-Goals

**Goals:**
- Create a reusable TypeScript client for LM Studio API
- Support text-only chat completions (prompt generation)
- Support multimodal chat completions with base64-encoded images
- Provide strong typing for requests and responses
- Centralize configuration (URL, model selection)

**Non-Goals:**
- Implement ComfyUI or other external API clients (separate concern)
- Handle authentication (LM Studio has no auth locally)
- Implement caching or request pooling

## Decisions

### 1. Client Class Structure
Decision: Create an `LmStudioClient` class with typed methods.

Rationale: A class allows configuration to be set once in the constructor, and methods map cleanly to API operations. Alternatives considered:
- Functional approach: Less intuitive for configuration-heavy clients
- Factory pattern: Overkill for a single client variant

### 2. HTTP Client
Decision: Use Bun's built-in `fetch` API.

Rationale: The project already uses Bun as the runtime (per architecture doc). No external HTTP libraries needed.

### 3. Image Format
Decision: Accept base64-encoded images and convert to data URLs internally.

Rationale: LM Studio expects `data:image/<format>;base64,<data>` format. Centralizing this conversion in the client keeps calling code simple.

### 4. Response Parsing
Decision: Parse response as JSON and return typed objects.

Rationale: The architecture doc shows responses use `response_format: {type: "json_object"}`, so we should deserialize and type the result.

## Risks / Trade-offs

- **Risk**: LM Studio API may change → Mitigation: Version the client, add integration tests
- **Risk**: Large base64 images could hit size limits → Mitigation: Document image size recommendations in JSDoc
- **Trade-off**: Sync-only for now (no streaming) → Future enhancement if needed