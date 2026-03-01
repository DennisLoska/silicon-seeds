import { health } from "./health";
import { job } from "./job";
import { not_found } from "./void";

export namespace ApiServer {
  let server: Bun.Server<undefined>;

  export function start() {
    server = Bun.serve({
      port: 3000,
      idleTimeout: 60,
      routes: {
        "/api/health": Api.handlers.health,
        "/api/job": Api.handlers.job,
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
    job,
  };
}
