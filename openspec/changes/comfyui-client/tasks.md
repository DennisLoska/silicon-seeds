# Implementation Tasks: ComfyUI Z-Image-Turbo Client

## 1. Setup

- [x] 1.1 Create directory structure: `src/lib/` for client implementations
- [x] 1.2 Create main entry point at `src/index.ts` to export clients
- [ ] 1.3 Initialize TypeScript configuration for the client library
- [ ] 1.4 Set up package.json with necessary dependencies (node-fetch or axios)
- [ ] 1.5 Configure build output directory and type declarations

## 2. Type Definitions

- [x] 2.1 Define `ZImageTurboError` class with statusCode and responseBody properties
- [x] 2.2 Define `ImageResult` interface with url and optional buffer fields
- [x] 2.3 Define `ZImageTurboConfig` interface with baseUrl field
- [x] 2.4 Define `ZImageTurboInput` interface with prompt field

## 3. Core Client Implementation

- [x] 3.1 Create `ZImageTurboClient` class (no inheritance)
- [x] 3.2 Implement constructor accepting config object with baseUrl
- [x] 3.3 Load workflow JSON file from `src/lib/workflows/image_z_image_turbo_12_steps_720p.json`
- [x] 3.4 Override only the positive prompt field (node 57:27) in the workflow
- [ ] 3.5 Implement error handling for network failures, HTTP errors (4xx/5xx), JSON parsing

## 4. ZImageTurbo-Specific Implementation

- [x] 4.1 Import workflow template as JSON module
- [x] 4.2 Build complete prompt JSON structure from workflow template
- [x] 4.3 Implement `generate()` method accepting ZImageTurboInput
- [ ] 4.4 Map prompt to node 57:27 (CLIPTextEncode) text input
- [ ] 4.5 Handle seed parameter: use provided or auto-generate with secure randomness
- [ ] 4.6 Handle width/height parameters: override empty latent image settings
- [ ] 4.7 Handle negativePrompt parameter
- [x] 4.8 Map model loaders with fixed filenames (already in JSON template)
- [x] 4.9 Set KSampler parameters (already in JSON template)
- [ ] 4.10 Handle steps parameter: override sampler settings
- [ ] 4.11 Implement result parsing from ComfyUI response to ImageResult[]

## 5. Testing and Integration

- [ ] 5.1 Create integration test suite using local ComfyUI instance
- [ ] 5.2 Test text prompt input scenario (requirement: node 57:27 mapping)
- [ ] 5.3 Test seed configuration scenario including auto-generation
- [ ] 5.4 Test resolution settings with defaults and custom values
- [ ] 5.5 Test negative prompt handling
- [ ] 5.6 Verify model loader configuration matches spec exactly
- [ ] 5.7 Test sampler parameters: res_multistep, simple, cfg=1, denoise=1
- [ ] 5.8 Test image output retrieval and ImageResult format (requirement: node 9 SaveImage)
- [x] 5.9 Update src/index.ts to export ZImageTurboClient
- [ ] 5.10 Create usage documentation with code examples
