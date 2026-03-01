import { ApiServer } from "./api/Api";
import { ImageGenerator } from "./image/image-generator";
import { PromptGenerator } from "./prompts/prompt-generator";
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
// - receives image prompt
// - creates one video at a time
// - perhaps image queue should be always completely empty first
//
// MetadataGenerator
// - receive video script as input
// - calls AudioGenerator to create TTS audio file
// - uses length of audio file to determine video length in seconds
// - defines seconds per image, transition
// - defines video transcript / captions to be pot. used
//
// JobOrchestrator (db integration)
// - subscribed to all relevant events related to a job
// - keeps track of a job's progress / state via SQLite database by job id

async function main() {
  ImageGenerator.init();
  VideoGenerator.init();
  PromptGenerator.init();
  ApiServer.start();
  SocketServer.start();

  process.on("SIGINT", () => {
    SocketServer.stop();
    ApiServer.stop();
    process.exit(1);
  });
}

main();
