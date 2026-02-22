# Video Client Specification

## Requirements

### Requirement: Image-to-Video Generation

The video-client SHALL generate videos from a single static image using the WAN2.2 i2v workflow.

#### Scenario: Generate video from image and positive prompt

WHEN the user calls `generate()` with `imagePath` and `prompt`
THEN the client SHALL construct a workflow payload with the LoadImage node (ID: 97) inputs.image set to the provided imagePath
AND the CLIPTextEncode positive node (ID: 93) inputs.text set to the provided prompt

#### Scenario: Handle negative prompt from fixed configuration

WHEN the workflow JSON contains a predefined negative prompt in CLIPTextEncode negative node
THEN the client SHALL NOT override the negative prompt value
AND the generated video SHALL use the negative prompt specified in the workflow JSON

#### Scenario: Output video file URL

WHEN the ComfyUI server processes the workflow successfully
THEN the client SHALL return an array of `VideoResult` objects
AND each `VideoResult` SHALL contain a `url` field pointing to the generated video file
AND the `url` SHALL be constructed from the ComfyUI server's base URL and the returned filename

#### Scenario: Handle image input validation

WHEN the provided imagePath does not exist or is inaccessible
THEN the ComfyUI server SHALL return an error response
AND the client SHALL wrap the error in a `VideoError` exception with HTTP status code and response body

#### Scenario: Handle empty or missing prompt

WHEN the prompt string is empty or contains only whitespace
THEN the client SHALL send the empty prompt to the ComfyUI workflow
AND the generated video SHALL be conditioned on an empty (no-op) text embedding

#### Scenario: Handle video generation errors

WHEN the ComfyUI workflow execution fails due to model loading, sampling, or decode errors
THEN the server SHALL return a JSON error response
AND the client SHALL throw a `VideoError` with statusCode and responseBody set

#### Scenario: Video output format and resolution

WHEN the workflow completes successfully
THEN the output video SHALL be in MP4 format
AND the resolution SHALL be 1280x720 pixels
AND the duration SHALL be approximately 5 seconds (121 frames at 24fps)
