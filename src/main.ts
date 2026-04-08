import { ApiServer } from "./api/api";
import { AudioGenerator } from "./audio/audio-generator";
import { ImageGenerator } from "./image/image-generator";
import { JobOrchestrator } from "./jobs/jobs";
import { Logger } from "./logger/logger";
import { SocketServer } from "./socket/socket-server";
import { VideoGenerator } from "./video/video-generator";

// TODO list:
//
// General
// - Distinct mode: image generation, audio generation, video generation
// - Gallery: see assets across all jobs
// - ability to resume or pause a job
// - ability to cancel a job
// - ability to re-generate a specific asset
// - Make UI reactive with SSE instead of polling
// - Add script event
// - Generate a random name for each job
// - Add new composition event which includes the combined video
// - Make status updates more pretty
//
// Bugs
// - Fix display of images in media tab
// - Fix jobs filters
// - race condition when queueing multiple jobs at same time (queue block check)
// - reconnecting websockets
//
// Performance
// - scalability issues
// - race conditions
//
// Workflows
// - LTX workflows
// - Optimize WAN2.2 workflow
// - 2K image workflow
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

  JobOrchestrator.init();
  ImageGenerator.init();
  VideoGenerator.init();
  AudioGenerator.init();

  ApiServer.start();
  await SocketServer.start();

  process.on("SIGINT", () => {
    SocketServer.stop();
    ApiServer.stop();
    process.exit(1);
  });
}

main();
