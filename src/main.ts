import { ApiServer } from "./api/api";
import { ImageGenerator } from "./image/image-generator";
import { SocketServer } from "./socket/socket-server";
import { VideoGenerator } from "./video/video-generator";

// TODO list:
//
// AudioGenerator
// - can generate TTS voiceover
// - can generate background instrumental based on metadata length
//
// Api
// - parameterize the art style, client id, batch size
//
// VideoGenerator
// - if all images for a job are complete -> generate all the videos for them
// - jobId association with correct base image (i2v)
//
// Metadata
// - receive video script as input
// - calls AudioGenerator to create TTS audio file
// - uses length of audio file to determine video length in seconds
// - defines seconds per image, transition
// - defines video transcript / captions to be pot. used
//
// QueueManager
// - Move image and video queue here and make image priority
// - decouple the different jobs so they don't trigger each other
//
// JobOrchestrator (db integration)
// - subscribed to all relevant events related to a job
// - keeps track of a job's progress / state via SQLite database by job id
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

async function main() {
  ImageGenerator.init();
  VideoGenerator.init();

  ApiServer.start();
  await SocketServer.start();

  process.on("SIGINT", () => {
    SocketServer.stop();
    ApiServer.stop();
    process.exit(1);
  });
}

main();
