# ComfyUI Client Design Document

## Context

### ComfyUI API Overview

ComfyUI exposes a REST API for queuing and managing image generation workflows. The API operates on a prompt graph where:

- **Prompt**: JSON object mapping node IDs to their inputs and class types
- **Queue**: Users submit prompts, receive a `prompt_id`, then poll for results
- **Nodes**: Each node has a `class_type` and `inputs` that reference other nodes via `[node_id, output_index]`

### Workflow Structure

The z-image-turbo workflow follows this execution flow:
1. Loaders (UNET, CLIP, VAE) initialize models
2. `EmptySD3LatentImage` creates latent space
3. `ModelSamplingAuraFlow` modifies model sampling parameters
4. `CLIPTextEncode` encodes positive prompt; `ConditioningZeroOut` zeros negative conditioning
5. `KSampler` generates image from latent using model + conditioning
6. `VAEDecode` converts latent to image
7. `SaveImage` writes output

## Goals

1. **Type Safety**: TypeScript interfaces for each workflow's inputs/outputs prevent runtime errors
2. **Workflow Isolation**: One class per workflow prevents parameter leakage between use cases
3. **Developer Experience**: Clear, self-documenting classes with IDE autocomplete
4. **Extensibility**: Easy to add new workflow clients following the same pattern
5. **Error Handling**: Consistent error propagation across all clients

## Architecture Decisions

### Class Hierarchy

```
ComfyUIBaseClient (abstract)
  ├── ZImageTurboClient extends ComfyUIBaseClient
  └── [Future: OtherWorkflowClients]
```

**Rationale**: Abstract base class provides common HTTP handling while allowing workflow-specific overrides.

### Base Client Responsibilities

```typescript
export abstract class ComfyUIBaseClient {
  protected baseUrl: string;
  
  constructor(config: { baseUrl: string });
  
  // Internal methods for API communication
  protected generateRequestId(): string;
  protected queuePrompt(prompt: Record<string, any>): Promise<{ prompt_id: number }>;
  protected getQueueStatus(promptId: number): Promise<any>;
  protected getImageResults(promptId: number): Promise<ImageResult[]>;
}
```

**Key Decisions**:
- `generateRequestId()`: Creates unique IDs (UUID or timestamp-based)
- `queuePrompt()`: POST to `/prompt` endpoint
- `getQueueStatus()`: Polls `/status` or similar endpoint
- `getImageResults()`: Retrieves images from `/history` or direct download

### ZImageTurboClient Design

```typescript
export interface ZImageTurboConfig {
  baseUrl: string;
}

export interface ZImageTurboInput {
  prompt: string;                          // Required positive prompt
  seed?: number;                           // Optional reproducibility
  steps?: number;                          // Override default (12)
  width?: number;                          // Override default (1280)
  height?: number;                         // Override default (720)
  negativePrompt?: string;                 // Optional negative prompt
}

export interface ImageResult {
  url: string;
  buffer?: Buffer;
}

export class ZImageTurboClient extends ComfyUIBaseClient {
  constructor(config: ZImageTurboConfig);
  
  async generate(input: ZImageTurboInput): Promise<ImageResult[]>;
}
```

**Node Mapping Strategy**:

| Workflow Node | Input Parameter | Default |
|---------------|-----------------|---------|
| `57:13` EmptySD3LatentImage | `width`, `height`, `batch_size` | 1280x720x1 |
| `57:3` KSampler | `seed`, `steps`, `cfg`, `sampler_name`, `scheduler`, `denoise` | Auto, 12, 1, res_multistep, simple, 1 |
| `57:28` UNETLoader | Fixed: z_image_turbo_bf16.safetensors | — |
| `57:30` CLIPLoader | Fixed: qwen_3_4b.safetensors, type=lumina2 | — |
| `57:29` VAELoader | Fixed: ae.safetensors | — |

### Input Parameter Handling

**User-Facing Parameters** (configurable):
- `prompt`: Maps to `57:27.text`
- `seed`: Maps to `57:3.seed` (auto-generate if omitted)
- `steps`: Maps to `57:3.steps`
- `width`, `height`: Map to `57:13.width/height`

**Fixed Parameters** (hardcoded):
- Model, CLIP, VAE loaders (workflow-specific weights)
- Sampler configuration (res_multistep/simple)
- CFG=1, denoise=1

### Error Handling Pattern

```typescript
export class ComfyUIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = "ComfyUIError";
  }
}
```

**Scenarios Covered**:
- Network failures (connection refused, timeout)
- HTTP errors (4xx/5xx responses)
- Invalid JSON parsing
- Missing workflow nodes
- Result retrieval timeouts

## Risks and Trade-offs

### Risk 1: Workflow Rigidity

**Trade-off**: One class per workflow means each change requires a new class.

**Mitigation**: 
- Use composition for shared components (e.g., `KSamplerConfig`)
- Support partial overrides via input parameters
- Document which parameters are safe to customize

### Risk 2: API Versioning

**Trade-off**: ComfyUI API may evolve, breaking clients.

**Mitigation**:
- Abstract HTTP layer in base class
- Version the client interface (e.g., `ComfyUIBaseClientV1`)
- Add configuration for API endpoint paths

### Risk 3: Seed Management

**Trade-off**: Auto-generated seeds lose reproducibility; user-provided seeds may collide.

**Mitigation**:
- Use cryptographically secure random (WebCrypto `randomUUID()`)
- Document seed behavior in JSDoc
- Consider separate `generateReproducible()` method

### Risk 4: Image Result Format

**Trade-off**: Supporting both URL and Buffer increases complexity.

**Mitigation**:
- Make `buffer` optional with clear documentation
- Provide utility methods: `downloadImage(buffer: Buffer)`, `saveToFile(result, path)`
- Consider separate return types for browser vs Node.js environments

### Risk 5: Loader Parameters

**Trade-off**: Hardcoding loader parameters reduces flexibility.

**Mitigation**:
- Allow loader config override via optional input field
- Document default weights and how to change them
- Consider workflow-specific constants file

## Migration Plan

### Phase 1: Base Client Implementation

1. Create `src/lib/comfyui-base-client.ts`
2. Implement HTTP communication methods
3. Add error types and utilities
4. Write unit tests for base functionality

**Deliverable**: `ComfyUIBaseClient` with mockable API layer

### Phase 2: ZImageTurbo Client

1. Create `src/lib/z-image-turbo-client.ts`
2. Implement node mapping logic
3. Add input validation
4. Test against local ComfyUI instance

**Deliverable**: Working `ZImageTurboClient` with integration tests

### Phase 3: Integration & Documentation

1. Update `src/index.ts` to export new clients
2. Create usage examples
3. Document configuration options
4. Add TypeScript type definitions for release

**Deliverable**: Production-ready client with docs

### Phase 4: Future Work

- Additional workflow clients (audio_ace_step, transition_wan2, video_wan2)
- Shared utilities for common node types
- Configuration validation schema
- Connection pooling and retry logic

## Implementation Checklist

- [ ] Create `ComfyUIBaseClient` abstract class
- [ ] Implement `queuePrompt()` with prompt ID tracking
- [ ] Implement result polling mechanism
- [ ] Add error handling (network, HTTP, JSON)
- [ ] Create `ZImageTurboConfig` interface
- [ ] Create `ZImageTurboInput` interface
- [ ] Map all workflow nodes to client parameters
- [ ] Implement `generate()` method
- [ ] Write unit tests for base client
- [ ] Write integration tests for z-image-turbo
- [ ] Export clients in `index.ts`
- [ ] Create usage documentation
