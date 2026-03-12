import { Metadata } from "../meta/meta";
import { health } from "./health";
import { compose_video } from "./jobs/compose-video";
import { script_to_scenes } from "./jobs/script-to-scenes";
import { text_to_image } from "./jobs/text-to-image";
import { text_to_image_to_video } from "./jobs/text-to-image-to-video";
import { text_to_instrumental } from "./jobs/text-to-instrumental";
import { text_to_script } from "./jobs/text-to-script";
import { text_to_speech } from "./jobs/text-to-speech";
import { text_to_text } from "./jobs/text-to-text";
import { video_transition } from "./jobs/video-transition";
import { not_found } from "./void";

export namespace ApiServer {
  let server: Bun.Server<undefined>;

  export function start() {
    server = Bun.serve({
      port: 3000,
      idleTimeout: Metadata.TIMEOUT,
      routes: {
        "/api/health": Api.handlers.health,
        "/api/message": Api.handlers.text_to_text,
        "/api/jobs/images": Api.handlers.text_to_image,
        // "/api/jobs/scripts": Api.handlers.text_to_script,
        "/api/jobs/scenes": Api.handlers.script_to_scenes,
        "/api/jobs/videos": Api.handlers.text_to_image_to_video,
        "/api/jobs/videos/compose": Api.handlers.compose_video,
        "/api/jobs/videos/transition": Api.handlers.video_transition,
        "/api/jobs/tts": Api.handlers.text_to_speech,
        "/api/jobs/instrumental": Api.handlers.text_to_instrumental,
        // TODO text to video
      },
      fetch: Api.handlers.not_found,
    });
  }

  export async function stop() {
    await server.stop(true);
  }
}

namespace Api {
  export const handlers = {
    health,
    not_found,
    text_to_text,
    text_to_script,
    text_to_image,
    script_to_scenes,
    text_to_image_to_video,
    text_to_speech,
    text_to_instrumental,
    compose_video,
    video_transition,
  };
}
