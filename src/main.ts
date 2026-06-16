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
// Critical
// - SHIP IT
// - Asset compression + caching
// - Vid-to-vid workflow
// - Keep models in memory
// - keep cut out video snippets
// - export davinci resolve timeline
// - generate autocaptions
// - manually select clips and auto-place them
// - pick clips dynamically from content library
// - Social Media integration
// - Metadata for existing files
// - fish audio, voice clone, replace kokoro
// - zimage in cpu, fish audio in cpu
// - export assets as davinci project timeline
// - preserve autocut assets
// - preserve metadata about what has been cut and preserve removed snippets
// - allow autocut clip regeneration with transitions

// Content
// - consistent style and transitions
// - consistent character
// - consistent voice
// - consistent speed
// - better text captions
//
// General
// - ability to resume or pause a job
// - distinct mode: video generation
//
// Bugs
// - user-facing API errors are inconsistent between JSON and HTML fragment flows
// - image/video asset path generation is duplicated across templates and can drift
//
// Workflows
// - Video -> extract audio -> transcription -> TransVidMap
//                                           -> images -> ai video
//                                                     -> ai video, TransVidMap, Video -> final cut
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
  await DB.Jobs.failJobsWithNoEvents();
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
