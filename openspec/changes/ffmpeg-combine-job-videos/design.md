## Implementation Details

### Code Changes Required

1. **src/events/events.ts**
   ```typescript
   export interface ImagePromptEvent extends JobBaseEvent {
     prompt: string;
     type: Event.NewImagePrompt;
     index?: number;  // ← NEW
   }

   export interface VideoPromptEvent extends JobBaseEvent {
     prompt: string;
     type: Event.NewVideoPrompt;
     filename: string;
     index?: number;  // ← NEW (inherits from image)
   }

   export interface TransitionPromptEvent extends JobBaseEvent {
     prompt: string;
     type: Event.NewTransitionPrompt;
     startImg: string;
     endImg: string;
     index?: number;  // ← NEW (implicit position between clips)
   }
   ```

2. **src/jobs/jobs.ts**
   ```typescript
   function create_task(event: Partial<JobEvent>): JobEvent {
     const { jobId, id, mode, type, prompt, index } = event;  // ← destruct index
     Utils.assert(jobId && type, "Must provide task type to define a task!");
     Utils.assert(mode, "Must provide 'mode' to define a  task!");

     const base: JobBaseEvent = {
       id: id ?? Bun.randomUUIDv7(),
       created_at: new Date().toISOString(),
       status: "pending",
       jobId,
       mode,
     };

     switch (event.type) {
       case Event.NewImagePrompt:
         Utils.assert(prompt, "Must provide 'prompt' to define an image task!");
         return {
           ...base,
           type: Event.NewImagePrompt,
           prompt,
           index,  // ← NEW: preserve index
         };

       case Event.NewVideoPrompt:
         const { filename } = event;
         Utils.assert(prompt, "Must provide 'prompt' to define an video task!");
         Utils.assert(
           filename,
           "Must provide 'filename' to define a videotask!",
         );
         return {
           ...base,
           type: Event.NewVideoPrompt,
           prompt,
           filename,
           index,  // ← NEW: preserve index
         };

       case Event.NewTransitionPrompt:
         const { startImg, endImg } = event;
         Utils.assert(
           prompt,
           "Must provide 'prompt' to define a video transition task!",
         );
         Utils.assert(
           startImg,
           `Must provide '${startImg}' to define a transition task!`,
         );
         Utils.assert(
           endImg,
           `Must provide '${endImg}' to define a transition task!`,
         );
         return {
           ...base,
           type: Event.NewTransitionPrompt,
           prompt,
           startImg,
           endImg,
           index,  // ← NEW: preserve index
         };

       // ...
     }
   }
   ```

3. **src/prompts/prompt-generator.ts**
   ```typescript
   export async function image_scene_prompts(
     jobId: string,
     mode: JobMode,
     text: string,
     amount: number,
     preset?: Presets,
   ) {
     // ... LLM generates scenes array ...
     
     for (const scene of scenes) {
       const index = scenes.indexOf(scene);  // ← track position
       preset
         ? txt_to_img_prompt(jobId, mode, scene, 1, preset, index)
         : txt_to_img_prompt(jobId, mode, scene, 1, undefined, index);
     }
   }

   export async function txt_to_img_prompt(
     jobId: string,
     mode: JobMode = JobMode.Image,
     message: string,
     batchSize = 1,
     preset?: Presets,
     index?: number,  // ← NEW parameter
   ) {
     // ... generate prompts ...
     
     ImageGenerator.schedule_image({ 
       jobId, 
       mode, 
       prompt, 
       index  // ← pass through
     });
   }
   ```

4. **src/image/image-generator.ts**
   ```typescript
   export function schedule_image(event: {
     id?: string;
     jobId: string;
     mode: JobMode;
     prompt: string;
     index?: number;  // ← NEW
   }) {
     JobOrchestrator.schedule_task({
       ...event,
       type: Event.NewImagePrompt,
     });
   }
   ```

5. **src/video/video-generator.ts**
   ```typescript
   export function schedule_video(event: {
     jobId: string;
     prompt: string;
     filename: string;
     index?: number;  // ← NEW (inherited from image)
   }) {
     JobOrchestrator.schedule_task({
       ...event,
       type: Event.NewVideoPrompt,
       mode: JobMode.Video,
     });
   }

   export async function combine_outputs(jobId: string): Promise<void> {
     const events = JobOrchestrator.job_events(jobId);
     
     // Filter to only video/transition events that are complete
     const outputEvents = events.filter(
       (e) => e.status === "complete" &&
         (e.type === Event.NewVideoPrompt || e.type === Event.NewTransitionPrompt)
     );
     
     Utils.assert(outputEvents.length > 0, `No completed video or transition events found for job ${jobId}`);
     
     // Sort by index to ensure correct sequence
     outputEvents.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
     
     // Build ordered list of filenames from event metadata
     const files: string[] = [];
     for (const e of outputEvents) {
       const meta = job.meta[e.id] as any;
       Utils.assert(meta && meta.images, `Missing metadata for event ${e.id}`);
       
       const filename = meta.images[0]?.filename;
       Utils.assert(filename, `No filename found in metadata for event ${e.id}`);
       
       files.push(filename);
     }
     
     // Build file list for ffmpeg concat demuxer
     const fileList = files.map(f => `file '${f}'`).join('\n');
     const listFile = `/tmp/${jobId}_concat.txt`;
     await Bun.write(listFile, fileList);
     
     // Execute ffmpeg via spawn (consistent with meta.ts:40 pattern)
     const outputExt = Bun.env.COMBINED_OUTPUT_FORMAT || 'mp4';
     const outputFile = `${OUTPUT_DIR}/output-combined.${outputExt}`;
     
     try {
       const ffmpegProcess = spawn({
         cmd: [
           'ffmpeg',
           '-y',
           '-f', 'concat',
           '-safe', '0',
           '-i', listFile,
           '-c', 'copy',
           outputFile
         ],
         stdio: ['ignore', 'pipe', 'pipe'],
       });
       
       for await (const chunk of ffmpegProcess.stderr) {
         Logger.info('ffmpeg:', new TextDecoder().decode(chunk));
       }
       
       const status = await ffmpegProcess.exited;
       if (status !== 0) {
         throw new Error(`FFmpeg failed with exit code ${status}`);
       }
     } catch (error: any) {
       // Don't fail job on combiner errors
       Logger.error('Video combination failed:', error.message);
     } finally {
       await Bun.file(listFile).delete();
     }
   }
   ```

6. **src/comfyui/comfyui-client.ts**
   ```typescript
   if (input.kind === "image-to-transition") {
     api = wan2_2_img2transitionApi;
     api["6"].inputs.text = input.prompt;
     api["68"].inputs.image = input.startImage;
     api["67"].inputs.length = Metadata.TRANSITION_DURATION * Metadata.FPS + 1;
     api["62"].inputs.image = input.endImage;
     api["61"].inputs.filename_prefix = input.id;  // ← NEW: unique per transition
   }
   ```

### Integration Points Summary

**Critical**: The `JobOrchestrator.create_task()` function must be updated to preserve the `index` field across all event types. Without this change, index tracking will not work regardless of how it's passed in.

The combiner reads from `job.meta[event.id]` which is populated by `JobOrchestrator.init()` when events complete (see line 23).
