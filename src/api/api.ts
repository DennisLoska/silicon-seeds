import { health } from "./health";
import { script_to_scenes } from "./jobs/script-to-scenes";
import { text_to_image } from "./jobs/text-to-image";
import { text_to_script } from "./jobs/text-to-script";
import { text_to_text } from "./jobs/text-to-text";
import { not_found } from "./void";

export namespace ApiServer {
  let server: Bun.Server<undefined>;

  export function start() {
    server = Bun.serve({
      port: 3000,
      idleTimeout: 60,
      routes: {
        "/api/health": Api.handlers.health,
        "/api/jobs/images": Api.handlers.text_to_image,
        "/api/jobs/scripts": Api.handlers.text_to_script,
        "/api/jobs/scenes": Api.handlers.script_to_scenes,
        // TODO text to video
        // TODO image to video
        "/api/message": Api.handlers.text_to_text,
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
  };
}
