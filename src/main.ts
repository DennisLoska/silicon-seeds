import { ApiServer } from "./api/Api";
import { ImageGenerator } from "./images/image-generator";
import { PromptGenerator } from "./prompts/prompt-generator";
import { SocketServer } from "./socket/socket-server";

// AudioGenerator
// - can generate TTS voiceover
// - can generate background instrumental based on metadata length
// ArtStyle
// - responsible for providing the art style of the generated slop
// - can be provided as api query parameter to the job
// - will be used by the PromptGenerator
// SocketServer
// - Defines instance and event listeners for the socket server
// TextGenerator
// - generate a video script
// VideoGenerator
// - ...
// MetadataGenerator
// - receive video script as input
// - calls AudioGenerator to create TTS audio file
// - uses length of audio file to determine video length in seconds
// - defines seconds per image, transition
// - defines video transcript / captions to be pot. used
// JobOrchestrator
// - subscribed to all relevant events related to a job
// - keeps track of a job's progress / state via SQLite database by job id

async function main() {
  ImageGenerator.init();
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
