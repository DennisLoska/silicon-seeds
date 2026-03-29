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
import { list as jobs_list } from "./jobs/list";
import { not_found } from "./void";

export namespace ApiServer {
  let server: Bun.Server<undefined>;

  export function start() {
    const handlers = {
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
      jobs_list,
    };

    server = Bun.serve({
      port: 3000,
      idleTimeout: Metadata.TIMEOUT,
      routes: {
        "/api/health": handlers.health,
        "/api/message": handlers.text_to_text,
        "/api/jobs/images": handlers.text_to_image,
        "/api/jobs/scenes": handlers.script_to_scenes,
        "/api/jobs/videos": handlers.text_to_image_to_video,
        "/api/jobs/videos/compose": handlers.compose_video,
        "/api/jobs/videos/transition": handlers.video_transition,
        "/api/jobs/tts": handlers.text_to_speech,
        "/api/jobs/instrumental": handlers.text_to_instrumental,
        "/api/jobs/list": handlers.jobs_list,
      },
      fetch: handlers.not_found,
    });
  }

  export async function stop() {
    await server.stop(true);
  }
}
