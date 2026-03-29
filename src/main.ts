import { ApiServer } from "./api/api";
import { AudioGenerator } from "./audio/audio-generator";
import { ImageGenerator } from "./image/image-generator";
import { JobOrchestrator } from "./jobs/jobs";
import { Logger } from "./logger/logger";
import { SocketServer } from "./socket/socket-server";
import { VideoGenerator } from "./video/video-generator";

// TODO list:
// - Optimize WAN2.2 workflow
// - env files: dev, prod
// - db integration
//
// Job
// - user initiated retry on individual assets (or work with batches)
//
// Smarter Pipelines
// - Content Poker -> LLM judge to suggest rolling dice on some assets
// - Analyzer module to judge all prompts and output -> free content classification!
//
// Bugs
// - race condition when queueing multiple jobs at same time (queue block check)
// - reconnecting websockets
//
// Pipelines:
//   combined_video, tts, instrumental -> final cut
//
// - script -> scenes -> find content in content library -> metadata
// - captions? content library?
//
// Api
// - Perhaps use Hono framework?
// - parameterize the art style, client id, batch size
//
// Content Library
// - Vector database for RAG
// - Can pick matching content to find images or videos
//
// Workflows
// - LTX workflow
// - Optimize WAN2.2 workflow
// - 2K image workflow
// - Add LoRA support
//
// Metadata
// - defines video transcript / captions to be pot. used
// - add metadata to generated videos and images (used prompt, prompt id, job id, index)
//
// User
// - better-auth for authentication
// - Use jwt tokens in headers for verification
// - encode user id in jwt token
// - use user id in /api/jobs endpoint
//
// Frontend
// - Use i.e. Daisy UI to create a webapp
// - Distinct mode: image generation, audio generation, video generation
// - Composite mode: compose entire video from a video script (main pipeline)

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
