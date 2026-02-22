# ComfyUI Client Proposal

## Overview

This document proposes a ComfyUI client architecture where each workflow gets its own dedicated client class. This approach provides better type safety, clearer interfaces, and easier maintenance.

## Architecture

### Core Principles

1. **One Class Per Workflow**: Each ComfyUI workflow (JSON file) gets its own client class
2. **Workflow-Specific Interface**: Each client exposes only the parameters relevant to its workflow
3. **Type Safety**: TypeScript interfaces for each workflow's inputs/outputs
4. **Consistent Pattern**: All clients follow the same structure and error handling

### Base Client Structure

```typescript
export abstract class ComfyUIBaseClient {
  protected baseUrl: string;
  
  constructor(config: { baseUrl: string });
  
  protected generateRequestId(): string;
  protected queuePrompt(prompt: Record<string, any>): Promise<{ prompt_id: number }>;
  protected getQueueStatus(promptId: number): Promise<any>;
  protected getImageResults(promptId: number): Promise<ImageResult[]>;
}
```

### Workflow Client Structure

Each workflow client will:
- Extend the base client
- Define specific input interfaces for that workflow
- Provide typed methods for common operations
- Handle workflow-specific node mappings

## Z-Image-Turbo Workflow

### Workflow Analysis

The `image_z_image_turbo_12_steps_720p.json` workflow has these key components:

| Node ID | Class Type | Purpose |
|---------|-----------|---------|
| 57:3 | KSampler | Generates image from latent |
| 57:8 | VAEDecode | Decodes latent to image |
| 57:13 | EmptySD3LatentImage | Creates empty latent space (1280x720) |
| 57:27 | CLIPTextEncode | Encodes positive prompt |
| 57:33 | ConditioningZeroOut | Negative conditioning (zeroed) |
| 57:28 | UNETLoader | Loads z_image_turbo_bf16.safetensors model |
| 57:30 | CLIPLoader | Loads qwen_3_4b.safetensors CLIP |
| 57:29 | VAELoader | Loads ae.safetensors VAE |
| 9 | SaveImage | Saves output image |

### Parameters

**User-Facing Inputs:**
- `prompt` (string): Positive text prompt for image generation
- `seed` (number, optional): Random seed for reproducibility (default: auto-generated)
- `steps` (number, optional): Number of sampling steps (default: 12)
- `width` (number, optional): Image width (default: 1280)
- `height` (number, optional): Image height (default: 720)
- `negativePrompt` (string, optional): Negative prompt for what to avoid

**Fixed Configuration:**
- Model: z_image_turbo_bf16.safetensors
- CLIP: qwen_3_4b.safetensors  
- VAE: ae.safetensors
- Sampler: res_multistep
- Scheduler: simple
- CFG: 1
- Denoise: 1

### Proposed Client Interface

```typescript
export interface ZImageTurboConfig {
  baseUrl: string;
}

export interface ZImageTurboInput {
  prompt: string;
  seed?: number;
  steps?: number;
  width?: number;
  height?: number;
  negativePrompt?: string;
}

export interface ImageResult {
  url: string;
  buffer?: Buffer; // For server-side usage
}

export class ZImageTurboClient extends ComfyUIBaseClient {
  constructor(config: ZImageTurboConfig);
  
  async generate(
    input: ZImageTurboInput,
  ): Promise<ImageResult[]>;
}
```

## Implementation Plan

1. **Create base client** (`src/lib/comfyui-base-client.ts`)
   - Handle HTTP communication with ComfyUI API
   - Queue prompt management
   - Result retrieval

2. **Create workflow clients**
   - `src/lib/z-image-turbo-client.ts` (primary focus)
   - Future: additional clients per workflow

3. **Update index.ts** to export new clients

4. **Add tests** for the z-image-turbo client

## Benefits

1. **Type Safety**: IDEs can provide autocomplete for workflow-specific parameters
2. **Documentation**: Each class serves as documentation for its workflow
3. **Reusability**: Clients can be imported and used across projects
4. **Maintainability**: Changes to a workflow only affect one client class
5. **Testing**: Easier to mock and test individual workflows

## Next Steps

1. Implement the base ComfyUI client
2. Implement ZImageTurboClient with full parameter support
3. Test against actual ComfyUI instance
4. Document usage examples
5. Add additional workflow clients as needed
