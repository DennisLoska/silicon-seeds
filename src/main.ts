import { ApiServer } from "./api/api";
import { AudioGenerator } from "./audio/audio-generator";
import { DB } from "./db/db";
import { ImageGenerator } from "./image/image-generator";
import { JobOrchestrator } from "./jobs/jobs";
import { Logger } from "./logger/logger";
import { QueueManager } from "./queue/queue-manager";
import { SocketServer } from "./socket/socket-server";
import { VideoGenerator } from "./video/video-generator";

// TODO list:
//
// Content
//
// - consistent style and transitions
// - consistent character
// - consistent voice
// - consistent speed
// - better text captions

// General
// - ability to resume or pause a job
// - ability to re-generate a specific asset
// - distinct mode: audio generation, video generation
//
// Bugs
// - job is not marked as done when all events have finished
// - new items in gallery are added vertically and not horizontally
// - need to sanitize input text in input fields in UI otherwise it breaks json parsing
// - composite mode: generate video button is not disabled, but it should be whilst the job is running
// - media tab in job has zoom in effect on image
// - created_at format is messed up (no ms)
//
// Performance
// - create tx helper function in DB namesspace
// - Retry against model
// - scalability issues
// - race conditions
// - What if LLM enters death spiral?
// - Reconnecting websockets
//
// Nice to havee
// - Show content of uploaded file in compose view
// - reconnecting websockets
//
// Workflows
// - Optimize WAN2.2 workflow
// - Add LoRA support
//
// Metadata
// - defines video transcript / captions to be pot. used
// - add metadata to generated videos and images (used prompt, prompt id, job id, index)
//
// Pipelines:
// - combined_video, tts, instrumental -> final cut
// - script -> scenes -> find content in content library -> metadata
// - captions? content library?
//
// User
// - better-auth for authentication
// - Use jwt tokens in headers for verification
// - encode user id in jwt token
// - use user id in /api/jobs endpoint
//
// Smarter Pipelines
// - Content Poker -> LLM judge to suggest rolling dice on some assets
// - Analyzer module to judge all prompts and output -> free content classification!
//
// Content Library
// - Vector database for RAG
// - Can pick matching content to find images or videos
//
// Production
// - env files: dev, prod
// - runpod support
// - actual error handling

async function main() {
  await Logger.init();

  await DB.Jobs.failBrokenJobs();
  await DB.Jobs.finalizeCompletedJobs();
  await QueueManager.resume();
  JobOrchestrator.init();
  ImageGenerator.init();
  VideoGenerator.init();
  AudioGenerator.init();

  ApiServer.start();
  await SocketServer.start();
  await QueueManager.pump();

  process.on("SIGINT", () => {
    SocketServer.stop();
    ApiServer.stop();
    process.exit(1);
  });
}

main();
