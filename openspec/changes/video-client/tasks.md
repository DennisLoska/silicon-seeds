## 1. Setup

- [x] 1.1 Create directory structure: `src/lib/comfyui/` if not exists
- [x] 1.2 Create main entry point file: `src/lib/comfyui/video-client.ts`
- [x] 1.3 Import WAN2.2 workflow JSON template: `video_wan2_2_14B_i2v_720p_5s.json`
- [x] 1.4 Export VideoClient class as default export

## 2. Type Definitions

- [x] 2.1 Create VideoError class extending Error with statusCode and responseBody properties
- [x] 2.2 Define VideoInput interface with imagePath (string) and prompt (string) fields
- [x] 2.3 Define VideoResult interface with url (string) and optional buffer (Buffer) fields

## 3. Core Client Implementation

- [x] 3.1 Implement constructor accepting config object with baseUrl string
- [x] 3.2 Implement generate() method accepting VideoInput and returning Promise<VideoResult[]>
- [x] 3.3 Implement HTTP POST request to ${baseUrl}/prompt endpoint
- [x] 3.4 Add try-catch error handling wrapping ComfyUI responses in VideoError
- [ ] 3.5 Parse JSON response and extract video output filenames

## 4. Video-Specific Implementation

- [x] 4.1 Implement buildWorkflow() method cloning workflow template
- [x] 4.2 Override node 97 (LoadImage) inputs.image with input.imagePath
- [x] 4.3 Override node 93 (CLIPTextEncode positive) inputs.text with input.prompt
- [x] 4.4 Preserve negative prompt from workflow JSON (do not override)
- [ ] 4.5 Return complete workflow object for ComfyUI processing

## 5. Testing and Integration

- [ ] 5.1 Verify error handling for invalid image paths
- [ ] 5.2 Test empty/whitespace prompt handling
- [ ] 5.3 Validate VideoResult URL construction from server response
- [ ] 5.4 Confirm MP4 output format and 1280x720 resolution in workflow
- [x] 5.5 Integrate with existing ComfyUI client module exports

