# Video Client Proposal

## Why This Change Is Needed

The current codebase lacks native video generation capability. While image-to-image workflows are well-supported through clients like `ZImageTurboClient`, there's no equivalent for generating short videos from images using the WAN 2.2 model. Adding video generation capability enables:

- **New feature support**: Generate 5-second HD videos (1280x720, 121 frames) from static images
- **Unified API**: Consistent client interface across image and video generation
- **Automation**: Programmatic video creation for content workflows
- **Future extensibility**: Foundation for additional video models and formats

## What Changes Will Be Made

### New File: `/src/lib/comfyui/video-client.ts`

Create a standalone `VideoClient` class following the one-class-per-workflow architecture:

```typescript
import workflowTemplate from "../workflows/video_wan2_2_14B_i2v_720p_5s.json";

export interface VideoResult {
  url: string;
  buffer?: Buffer;
}

export interface VideoInput {
  imagePath: string;
  prompt: string;
}

export class VideoClient {
  private baseUrl: string;

  constructor(config: { baseUrl: string }) {
    this.baseUrl = config.baseUrl;
  }

  async generate(input: VideoInput): Promise<VideoResult[]> {
    const workflow = this.buildWorkflow(input);
    
    // POST to /prompt endpoint
    // Return video file URL(s)
  }

  private buildWorkflow(input: VideoInput): Record<string, any> {
    const workflow = { ...workflowTemplate };
    
    // Override image path in LoadImage node (ID: 97)
    // Override positive prompt in CLIPTextEncode node (ID: 93)
    
    return workflow;
  }
}

export class VideoError extends Error {
  // Same pattern as ZImageTurboError
}
```

### Workflow Overrides

The workflow JSON requires two dynamic overrides:

1. **LoadImage node (ID: 97)**: `inputs.image` → set to provided `imagePath`
2. **CLIPTextEncode positive node (ID: 93)**: `inputs.text` → set to provided `prompt`

## New Capabilities

### video-client Capability

| Property | Value |
|----------|-------|
| **Name** | video-client |
| **Purpose** | Generate short HD videos from images using WAN 2.2 i2v model |
| **Input** | Image path + text prompt |
| **Output** | Video file URL(s) |
| **Model** | WAN 2.2 (14B, high+low noise checkpoints with LoRA) |
| **Resolution** | 1280x720 |
| **Duration** | ~5 seconds (121 frames @ 24fps) |

## Impact on Codebase

### Positive Impacts

- **Completeness**: Fills gap in multimodal generation capabilities
- **Consistency**: Extends existing client pattern to video domain
- **Reusability**: Same infrastructure patterns as `ZImageTurboClient`
- **Testability**: Isolated class with clear input/output contract

### Minimal Changes Required

- **No breaking changes**: Pure addition to codebase
- **No inheritance**: Standalone class (follows existing pattern)
- **No modifications** to existing image or workflow clients
- **Single new file**: `video-client.ts` (~80 lines expected)

### Dependencies

- Reuses existing workflow JSON (`video_wan2_2_14B_i2v_720p_5s.json`)
- Uses same HTTP client pattern (fetch to `/prompt` endpoint)
- Same error handling architecture
