# Z-Image-Turbo Workflow Client Specification

## Requirements

### Requirement: ZImageTurboClient Capabilities

The ZImageTurboClient SHALL provide a TypeScript class for interacting with the z-image-turbo workflow in ComfyUI. The client SHALL encapsulate all workflow-specific logic including model loading, sampling parameters, and image generation.

#### Scenario: Text Prompt Input
WHEN the user provides a text prompt to the generate method
THEN the client SHALL map the prompt to node 57:27 (CLIPTextEncode) as the `text` input parameter
AND the prompt SHALL be sent as part of the ComfyUI prompt JSON structure

#### Scenario: Seed Configuration
WHEN the user provides a seed value
THEN the client SHALL map the seed to node 57:3 (KSampler) as the `seed` input parameter
WHEN no seed is provided
THEN the client SHALL auto-generate a random integer using cryptographically secure randomness
AND the generated seed SHALL be used for the KSampler node

#### Scenario: Resolution Settings
WHEN width and height parameters are provided
THEN the client SHALL map them to node 57:13 (EmptySD3LatentImage) as `width` and `height` input parameters
WHEN no resolution is specified
THEN the default values of width=1280 and height=720 SHALL be used
AND the batch_size parameter SHALL default to 1

#### Scenario: Negative Prompt Handling
WHEN a negativePrompt is provided
THEN the client SHALL encode it using CLIPTextEncode for negative conditioning
WHEN no negative prompt is provided
THEN the client SHALL use ConditioningZeroOut (node 57:33) to zero out negative conditioning

#### Scenario: Model Loading
WHEN the client initializes
THEN it SHALL configure node 57:28 (UNETLoader) with model filename `z_image_turbo_bf16.safetensors`
AND node 57:30 (CLIPLoader) with model filename `qwen_3_4b.safetensors` and type `lumina2`
AND node 57:29 (VAELoader) with model filename `ae.safetensors`

#### Scenario: Sampler Parameters
WHEN generating an image
THEN the KSampler (node 57:3) SHALL use sampler_name `res_multistep`
AND scheduler SHALL be `simple`
AND cfg SHALL be `1`
AND denoise SHALL be `1`
WHEN steps parameter is provided
THEN it SHALL override the default of 12 steps

#### Scenario: Image Output
WHEN image generation completes
THEN the SaveImage node (9) SHALL produce the output
AND the client SHALL return an array of ImageResult objects
EACH ImageResult SHALL contain a URL for accessing the generated image
AND MAY optionally include a Buffer for server-side processing
