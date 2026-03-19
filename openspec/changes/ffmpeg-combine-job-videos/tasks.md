## 1. Add Index Tracking to Event System

- [ ] 1.1 Update ImagePromptEvent interface in `src/events/events.ts` with `index?: number`
- [ ] 1.2 Verify VideoPromptEvent has index field (add if needed)
- [ ] 1.3 Verify TransitionPromptEvent has index field (add if needed)

## 2. Update JobOrchestrator Task Creation

- [ ] 2.1 Add `index` to destructured fields in `create_task()` in `src/jobs/jobs.ts:64`
- [ ] 2.2 Add `index` property to ImagePrompt case return object (`src/jobs/jobs.ts:79-83`)
- [ ] 2.3 Add `index` property to VideoPrompt case return object (`src/jobs/jobs.ts:93-98`)
- [ ] 2.4 Add `index` property to TransitionPrompt case return object (`src/jobs/jobs.ts:115-121`)
- [ ] 2.5 Update VideoPromptEvent and TransitionPromptEvent interfaces with index field

## 3. Pass Index Through Image Generation

- [ ] 3.1 Update `ImageGenerator.schedule_image()` in `src/image/image-generator.ts` to accept `index?: number`
- [ ] 3.2 Ensure index flows through to JobOrchestrator.schedule_task()
- [ ] 3.3 Verify index is preserved in task creation (no spread loses it)

## 4. Pass Index Through Scene to Video Pipeline

- [ ] 4.1 Modify `PromptGenerator.image_scene_prompts()` in `src/prompts/prompt-generator.ts` to track scene index using array iteration
- [ ] 4.2 Update `txt_to_img_prompt()` signature to accept and forward index parameter
- [ ] 4.3 Pass index from images to videos via VideoGenerator.schedule_video()
- [ ] 4.4 Verify video events inherit correct index values

## 5. Fix Transition Filename Uniqueness

- [ ] 5.1 Add `api["61"].inputs.filename_prefix = input.id;` in `comfyui-client.ts` for transitions (line ~273)

## 6. Implement Video Combiner Function

- [ ] 6.1 Create `VideoGenerator.combine_outputs(jobId: string)` in `src/video/video-generator.ts`
- [ ] 6.2 Gather all output events from JobOrchestrator.job_events(jobId)
- [ ] 6.3 Filter to only complete video and transition events
- [ ] 6.4 Sort events by index field

## 7. FFmpeg Integration

- [ ] 7.1 Implement ffmpeg concat demuxer command building using Bun.spawn()
- [ ] 7.2 Build file list from sorted events, verify filenames exist
- [ ] 7.3 Handle COMBINED_OUTPUT_FORMAT env variable (mp4 default, webm alt)
- [ ] 7.4 Parse stderr for error detection and logging

## 8. Integration with Job Completion

- [ ] 8.1 Integrate combiner trigger in `JobOrchestrator.init()` completion handler
- [ ] 8.2 Verify all video + transition tasks reach "complete" status before combining
- [ ] 8.3 Add error handling: don't fail job if combiner encounters errors (log and continue)

## 9. Error Handling

- [ ] 9.1 Use Utils.assert for critical validations throughout combiner
- [ ] 9.2 Log specific errors when ffmpeg command fails via Logger.error()
- [ ] 9.3 Handle events without index field gracefully (default to 0)
