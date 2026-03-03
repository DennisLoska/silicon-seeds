import { health } from "./health";
import { text_to_image } from "./jobs/text-to-image";
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
        "/api/jobs/scripts": Api.handlers.text_to_text,
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
    text_to_image,
  };
}
