# Video Composition Pipeline - Data Flow Diagram

## Complete Flow with Index Tracking

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           SCRIPT INPUT (from compose-video.ts)                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  User Prompt → TextGenerator.create_script()                                                │
│    ↓                                                                                        │
│  "The seven deadly sins"                                                                    │
│    ↓                                                                                        │
│  LLM generates ~800-1300 word essay                                                         │
│    ↓                                                                                        │
│  Scene prompts (JSON array):                                                                │
│    [                                                                                       │
│      "A dark forest with twisted trees",          ← index=0                                │
│      "A bustling medieval marketplace",          ← index=1                                │
│      "A serene lakeside at sunset",              ← index=2                                │
│      "A dramatic battle in the mountains"        ← index=3                                │
│    ]                                                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                     PHASE 1: IMAGE GENERATION (with index tracking)                         │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  PromptGenerator.image_scene_prompts(jobId, mode, script, clipCount, preset)               │
│    ↓                                                                                        │
│  For each scene in scenes[]:                                                                │
│                                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│    │ Scene[0] = "A dark forest with twisted trees" (index=0)                           │  │
│    │   ↓                                                                               │  │
│    │   txt_to_img_prompt(jobId, mode, scene, 1, preset, index=0)                       │  │
│    │     ↓                                                                             │  │
│    │     ImageGenerator.schedule_image({                                               │  │
│    │       jobId,                                                                      │  │
│    │       prompt: "A dark forest...",                                                 │  │
│    │ +   index: 0           ← NEW: Track sequence order                                │  │
│    │     })                                                                            │  │
│    │       ↓                                                                           │  │
│    │       Event.emit(Event.NewImagePrompt, task)                                      │  │
│    │         ↓                                                                         │  │
│    │         QueueManager.imageQueue.push(task)                                        │  │
│    │           ↓                                                                       │  │
│    │           ImageGenerator.generate_image()                                         │  │
│    │             ↓                                                                     │  │
│    │             ComfyUIClient.generate({                                              │  │
│    │               id: event_id_abc,                                                   │  │
│    │ +             kind: "text-to-image",                                              │  │
│    │ +             prompt,                                                             │  │
│    │ +             index: 0          ← Flows through to API call                       │  │
│    │               filename_prefix: event_id_abc  ← ComfyUI uses this for filename     │  │
│    │             })                                                                    │  │
│    │               ↓                                                                   │  │
│    │               OUTPUT_DIR/                                                         │  │
│    │                 ├── evt_abc.mp4   ← image index=0 (source asset)                  │  │
│    └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│    │ Scene[1] = "A bustling medieval marketplace" (index=1)                            │  │
│    │   ↓                                                                               │  │
│    │   ImageGenerator.schedule_image({ ... index: 1 })                                 │  │
│    │     ↓                                                                             │  │
│    │     OUTPUT_DIR/                                                                   │  │
│    │       └── evt_def.mp4   ← image index=1 (source asset)                            │  │
│    └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                             │
│    ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│    │ Scene[2] = "A serene lakeside at sunset" (index=2)                                │  │
│    │   ↓                                                                               │  │
│    │   OUTPUT_DIR/                                                                     │  │
│    │     └── evt_ghi.mp4   ← image index=2 (source asset)                              │  │
│    └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                             │
│  Note: Images may complete OUT OF ORDER due to ComfyUI queue scheduling                     │
│        But each retains its index for correct ordering later                                │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│               PHASE 2: VIDEO GENERATION (index inherited from images)                       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  For each completed image, img_to_vid_prompt() is triggered by socket-server.ts             │
│    ↓                                                                                        │
│  PromptGenerator.img_to_vid_prompt(promptId)                                                │
│    ↓                                                                                        │
│  Event = QueueManager.findEventById(promptId)                                               │
│    ↓                                                                                        │
│  Event has: { id, jobId, index: 0, prompt, ... }                                            │
│    ↓                                                                                        │
│  LLM generates video prompt based on image content                                          │
│    ↓                                                                                        │
│  VideoGenerator.schedule_video({                                                            │
│    jobId: event.jobId,                                                                      │
│    prompt: "Camera slowly pans through...",                                                  │
│ +  index: event.index      ← Inherits from source image                                     │
│    filename: event.filename   ← The original image filename                                │
│  })                                                                                         │
│    ↓                                                                                        │
│  JobOrchestrator.schedule_task({                                                            │
│    ...event,                                                                                │
│ +  index: event.index      ← Stored in job.meta[event.id]                                   │
│    type: Event.NewVideoPrompt,                                                              │
│    mode: JobMode.Video,                                                                     │
│  })                                                                                         │
│    ↓                                                                                        │
│  ComfyUIClient.generate({                                                                    │
│    id: video_event_id_xyz,                                                                  │
│    kind: "image-to-video",                                                                  │
│ +  filename_prefix: video_event_id_xyz   ← Unique per video event                          │
│    prompt,                                                                                  │
│    imagePath: event.filename                                                                │
│  })                                                                                         │
│    ↓                                                                                        │
│  OUTPUT_DIR/                                                                                │
│    ├── evt_abc.mp4          ← original image (preserved)                                    │
│    ├── evt_xyz.mp4   ← video derived from image[0], index=0, clip_0                        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                 PHASE 3: TRANSITION GENERATION (implicit ordering)                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  VideoGenerator.prepare_transitions(event) is triggered after all videos complete           │
│    ↓                                                                                        │
│  JobOrchestrator.job_events(jobId).filter(                                                  │
│    (e) => e.type === Event.NewVideoPrompt && e.status === "complete"                       │
│  )                                                                                          │
│    ↓                                                                                        │
│  Sort by index to ensure correct order:                                                     │
│    videos.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))                                   │
│    ↓                                                                                        │
│  For each adjacent pair [clip[0], clip[1]], [clip[1], clip[2]]...                          │
│    ↓                                                                                        │
│  Generate transition prompt using LLM                                                       │
│    ↓                                                                                        │
│  VideoGenerator.schedule_transition({                                                       │
│    jobId,                                                                                   │
│    prompt: "Smooth fade from forest to marketplace...",                                      │
│ +  index: i           ← Implicit position between clips                                    │
│    startImg: current.last_frame,                                                            │
│    endImg: next.first_frame                                                                 │
│  })                                                                                         │
│    ↓                                                                                        │
│  JobOrchestrator.schedule_task({                                                            │
│    ...event,                                                                                │
│ +  index: i               ← Stored in job.meta[event.id]                                   │
│    type: Event.NewTransitionPrompt,                                                         │
│    mode: JobMode.Video,                                                                     │
│  })                                                                                         │
│    ↓                                                                                        │
│  ComfyUIClient.generate({                                                                    │
│    id: transition_event_id_qrs,                                                             │
│    kind: "image-to-transition",                                                             │
│ +  filename_prefix: transition_event_id_qrs   ← UNIQUE per transition (NEW!)               │
│    prompt,                                                                                  │
│    startImage,                                                                              │
│    endImage                                                                                 │
│  })                                                                                         │
│    ↓                                                                                        │
│  OUTPUT_DIR/                                                                                │
│    ├── evt_abc.mp4          ← image[0] source                                               │
│    ├── evt_xyz.mp4   ← clip[0], index=0                                                     │
│ +  ├── trn_qrs.mp4   ← transition from clip[0]→clip[1], implicitly index=0 (NEW!)          │
│    └── evt_tuv.mp4   ← clip[1], index=1                                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                   PHASE 4: COMBINATION (final assembly)                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  VideoGenerator.combine_outputs(jobId) triggered after all tasks complete                   │
│    ↓                                                                                        │
│  Step 1: Gather all output events                                                           │
│    ┌──────────────────────────────────────────────────────────────────────────────────┐    │
│    │ const events = JobOrchestrator.job_events(jobId);                               │    │
│    │ // Returns array of all events in insertion order                                │    │
│    │                                                                                  │    │
│    │ const outputEvents = events.filter(                                              │    │
│    │   (e) => e.status === "complete" &&                                             │    │
│    │     (e.type === Event.NewVideoPrompt ||                                          │    │
│    │      e.type === Event.NewTransitionPrompt)                                       │    │
│    │ );                                                                               │    │
│    └──────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                             │
│  Step 2: Sort by index (explicit or implicit)                                               │
│    ┌──────────────────────────────────────────────────────────────────────────────────┐    │
│    │ outputEvents.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));                   │    │
│    │                                                                                  │    │
│    │ Result order:                                                                    │    │
│    │   1. evt_xyz.mp4    index=0 (clip[0])                                           │    │
│    │   2. trn_qrs.mp4    implicitly index=0 (trans[0])                               │    │
│    │   3. evt_tuv.mp4    index=1 (clip[1])                                           │    │
│    └──────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                             │
│  Step 3: Build ordered file list                                                            │
│    ┌──────────────────────────────────────────────────────────────────────────────────┐    │
│    │ const files = outputEvents.map(e => {                                            │    │
│    │   const meta = job.meta[e.id] as any;                                           │    │
│    │   return meta.images?.[0]?.filename || e.id + ".mp4";                           │    │
│    │ });                                                                              │    │
│    │                                                                                  │    │
│    │ // files = ["evt_xyz.mp4", "trn_qrs.mp4", "evt_tuv.mp4"]                        │    │
│    └──────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                             │
│  Step 4: Execute ffmpeg concat                                                              │
│    ┌──────────────────────────────────────────────────────────────────────────────────┐    │
│    │ // Build file list for ffmpeg concat demuxer                                    │    │
│    │ const fileList = files.map(f => `file '${f}'`).join('\n');                      │    │
│    │                                                                                  │    │
│    │ // Write to temp file                                                            │    │
│    │ const listFile = `/tmp/${jobId}_concat.txt`;                                    │    │
│    │ await Bun.write(listFile, fileList);                                            │    │
│    │                                                                                  │    │
│    │ // Execute ffmpeg                                                                │    │
│    │ const outputExt = Bun.env.COMBINED_OUTPUT_FORMAT || 'mp4';                      │    │
│    │ const outputFile = `${OUTPUT_DIR}/output-combined.${outputExt}`;                │    │
│    │                                                                                  │    │
│    │ const ffmpegProcess = spawn({                                                    │    │
│    │   cmd: [                                                                        │    │
│    │     'ffmpeg',                                                                   │    │
│    │     '-y',                                                                       │    │
│    │     '-f', 'concat',                                                             │    │
│    │     '-safe', '0',                                                               │    │
│    │     '-i', listFile,                                                             │    │
│    │     '-c', 'copy',                                                               │    │
│    │     outputFile                                                                  │    │
│    │   ],                                                                            │    │
│    │   stdio: ['ignore', 'pipe', 'pipe']                                             │    │
│    │ });                                                                             │    │
│    │                                                                                  │    │
│    │ // Stream stderr for progress/error logging                                     │    │
│    │ for await (const chunk of ffmpegProcess.stderr) {                               │    │
│    │   Logger.info('ffmpeg:', decoder.decode(chunk));                                │    │
│    │ }                                                                               │    │
│    │                                                                                  │    │
│    │ const status = await ffmpegProcess.exited;                                      │    │
│    │ if (status !== 0) {                                                             │    │
│    │   Logger.error('FFmpeg failed with exit code', status);                         │    │
│    │ }                                                                               │    │
│    └──────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           FINAL OUTPUT DIRECTORY                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  OUTPUT_DIR/                                                                                │
│    ├── evt_abc.mp4          ← image[0] source (preserved)                                   │
│    ├── evt_xyz.mp4   ← clip[0], index=0                                                     │
│    ├── trn_qrs.mp4   ← trans[0], implicitly index=0                                         │
│    ├── evt_tuv.mp4   ← clip[1], index=1                                                     │
│    ├── trn_wxy.mp4   ← trans[1], implicitly index=1 (if more clips)                         │
│    └── evt_zab.mp4   ← clip[2], index=2                                                     │
│                                                                                             │
│  output-combined.mp4        ← FINAL ASSEMBLED VIDEO                                         │
│      ordered by: clip[0] → trans[0] → clip[1] → trans[1] → clip[2]                         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              KEY DATA FLOW PRINCIPLES                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  1. INDEX PROPAGATION                                                                       │
│     scenes[0] → image[index=0] → video[index=0]                                             │
│     scenes[1] → image[index=1] → video[index=1]                                             │
│     scenes[2] → image[index=2] → video[index=2]                                             │
│                                                                                             │
│  2. TRANSITION IMPLICIT ORDERING                                                            │
│     Between clip[i] and clip[i+1] → trans[index=i]                                          │
│     (i goes from 0 to clipCount-2)                                                          │
│                                                                                             │
│  3. INDEPENDENT OF GENERATION TIMING                                                        │
│     Even if videos complete in order [2, 0, 1],                                            │
│     sorting by index ensures: [clip[0], trans[0], clip[1], trans[1], clip[2]]               │
│                                                                                             │
│  4. TRACEABILITY                                                                            │
│     Every output file can be traced back to its scene index                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
