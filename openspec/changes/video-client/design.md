# Video Client Design Document

## Context

### ComfyUI Video Workflow Structure

The WAN 2.2 image-to-video workflow (`video_wan2_2_14B_i2v_720p_5s.json`) is a complex ComfyUI graph that transforms static images into short HD videos:

**Key Components:**
- **LoadImage (node 97)**: Accepts image file path, outputs frame tensor
- **CLIPTextEncode (node 93)**: Encodes text prompt to embedding for positive conditioning
- **WanImageToVideo (node 98)**: Core video generation node that processes image + prompt into latent video
- **KSamplerAdvanced (nodes 86, 85)**: Two-stage sampling process with high+low noise checkpoints
- **VAEDecode (node 87)**: Decodes latent video to raw frames
- **CreateVideo (node 94)**: Aggregates frames into video stream
- **SaveVideo (node 108)**: Final output in MP4 format

**Workflow Data Flow:**
```
LoadImage → WanImageToVideo ← CLIPTextEncode (positive)
                              ↓
                         KSamplerAdvanced (2 stages)
                              ↓
                           VAEDecode
                              ↓
                          CreateVideo
                              ↓
                            SaveVideo
```

**Dynamic Parameters:**
- Node 97 (LoadImage): `inputs.image` - Input image path
- Node 93 (CLIPTextEncode): `inputs.text` - Positive text prompt

## Goals

1. **Type Safety**: Define explicit TypeScript interfaces for input/output contracts
2. **Minimal Code**: Single class per workflow, no inheritance hierarchy
3. **Consistency**: Follow existing `ZImageTurboClient` pattern exactly
4. **Isolation**: No modifications to existing clients or workflows
5. **Extensibility**: Foundation for additional video models (e.g., text-to-video)

## Architecture Decisions

### One-Class-Per-Workflow Pattern
- Each ComfyUI workflow gets its own dedicated client class
- No abstract base classes or inheritance
- Direct composition: `VideoClient` → `workflow.json`
- Rationale: Simplifies debugging, testing, and reduces coupling

### JSON Template Loading
- Import workflow JSON as static template
- Shallow copy with spread operator: `{ ...workflowTemplate }`
- Override only required fields (prompt + image path)
- No schema validation (ComfyUI validates at runtime)

### HTTP Client Reuse
- Same `/prompt` endpoint POST pattern as `ZImageTurboClient`
- Identical error handling structure (`VideoError`)
- Response format: array of results with URL + optional buffer

## Implementation Approach

### File Structure
```
src/lib/comfyui/
└── video-client.ts          # New: VideoClient class
```

### Class Signature
```typescript
export class VideoClient {
  private baseUrl: string;
  
  constructor(config: { baseUrl: string });
  
  async generate(input: VideoInput): Promise<VideoResult[]>;
  
  private buildWorkflow(input: VideoInput): Record<string, any>;
}
```

### Input/Output Contracts

**VideoInput Interface**
```typescript
interface VideoInput {
  imagePath: string;   // Path to input image (relative or absolute)
  prompt: string;      // Positive text prompt for video generation
}
```

**VideoResult Interface**
```typescript
interface VideoResult {
  url: string;         // Generated video URL
  buffer?: Buffer;     // Optional binary data for server-side processing
}
```

**Error Handling**
```typescript
class VideoError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  );
}
```

### Workflow Override Strategy

**Override 1: LoadImage Node (97)**
```typescript
workflow["97"].inputs.image = input.imagePath;
```

**Override 2: CLIPTextEncode Positive Node (93)**
```typescript
workflow["93"].inputs.text = input.prompt;
```

### Full Implementation Flow

1. **Constructor**: Store `baseUrl` from config
2. **generate()**: 
   - Call `buildWorkflow(input)`
   - POST to `${baseUrl}/prompt`
   - Parse JSON response
   - Return results array
3. **buildWorkflow()**:
   - Clone template: `{ ...workflowTemplate }`
   - Override node 97 image path
   - Override node 93 text prompt
   - Return modified workflow object

## Risks and Trade-offs

### Risk 1: No Input Validation
**Trade-off**: Skip validation for minimal code, rely on ComfyUI runtime errors
**Mitigation**: Add try-catch blocks to convert ComfyUI errors to `VideoError`

### Risk 2: Hardcoded Node IDs
**Trade-off**: Node IDs (97, 93) are magic strings in code
**Mitigation**: Document node IDs in comments; if workflow changes, update both JSON and source

### Risk 3: No Negative Prompt Support
**Trade-off**: Only positive prompt is user-configurable; negative prompt is fixed in JSON
**Rationale**: Current use case doesn't require dynamic negative prompts; can be extended later

### Risk 4: Single Frame Input Only
**Trade-off**: Design assumes single image input, not video sequences
**Mitigation**: This matches current workflow (WAN2.2 i2v), not text-to-video or video-in-video

### Performance Considerations
- **Network**: Each call is independent HTTP request (no connection pooling)
- **Memory**: Workflow object cloned per call (minimal overhead for JSON < 10KB)
- **Latency**: Video generation takes seconds; client timeout should exceed this

## Future Extensibility

Potential enhancements (out of scope):
1. Add `negativePrompt` to `VideoInput`
2. Support multiple output resolutions (currently fixed at 1280x720)
3. Add frame rate configuration (currently fixed at 24fps)
4. Support batch generation (currently `batch_size: 1`)
5. Add seed parameter for reproducible results
