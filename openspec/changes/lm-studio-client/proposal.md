## Why

The video content pipeline requires a type-safe client to interact with LM Studio's OpenAI-compatible API. Currently, raw fetch calls are used directly in the codebase. A dedicated client library will provide better type safety, reusable patterns for prompt generation and multimodal analysis, and cleaner integration with the worker components.

## What Changes

- Create a new TypeScript client library for LM Studio API communication
- Implement chat completion endpoint with text-only prompts
- Implement chat completion endpoint with optional base64-encoded image support (multimodal mode)
- Add configuration management for LM Studio URL and model selection
- Include proper error handling and response type definitions
- Export typed interfaces for messages, requests, and responses

## Capabilities

### New Capabilities
- `lm-studio-client`: A TypeScript client library providing typed methods to interact with LM Studio's OpenAI-compatible API. Supports text-only chat completions and multimodal chat completions with base64-encoded images.

### Modified Capabilities
- (none)

## Impact

- New directory: `src/lib/lm-studio/` or similar location for the client code
- Dependencies: TypeScript, existing HTTP fetch patterns from Bun
- Affects: Prompt Worker, Multimodal Analysis Worker - both will use this client instead of raw fetch calls