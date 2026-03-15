import { ApiServer } from "./api/api";
import { AudioGenerator } from "./audio/audio-generator";
import { ImageGenerator } from "./image/image-generator";
import { JobOrchestrator } from "./jobs/jobs";
import { Logger } from "./logger/logger";
import { SocketServer } from "./socket/socket-server";
import { VideoGenerator } from "./video/video-generator";

// TODO list:
//
// Bugs
// - race condition qhen queueing multiple jobs at same time (queue block check)
//
// Error Handling
// - trycatch in comfy client
// - add meaningful retries in prompt generator
//
// Pipelines:
//   combined_video, tts, instrumental -> final cut
//
// - script -> scenes -> find content in content library -> metadata
// - captions? content library?
// - Make sure images and videos are in correct order using the index
//
// Api
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
// Database
// - store jobs in db
// - store connected job assets in db via job id
// - associate jobs with a user id
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
