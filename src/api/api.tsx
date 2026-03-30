import { Hono } from "hono";
import { list as list_jobs } from "./jobs/list";
import { text_to_image } from "./jobs/text-to-image";
import { script_to_scenes } from "./jobs/script-to-scenes";
import { text_to_image_to_video } from "./jobs/text-to-image-to-video";
import { video_transition } from "./jobs/video-transition";
import { text_to_speech } from "./jobs/text-to-speech";
import { text_to_instrumental } from "./jobs/text-to-instrumental";
import { compose_video } from "./jobs/compose-video";
import { text_to_text } from "./jobs/text-to-text";
import { Metadata } from "../meta/meta";
import { health } from "./health";
import { Templates } from "../templates/templates";
import { not_found } from "./not_found";
import { Logger } from "../logger/logger";
import { serveStatic } from "hono/bun";
import fragmentRoutes from "./fragment";

const app = new Hono();

export namespace ApiServer {
  let server: Bun.Server<undefined>;

  export function start() {
    server = Bun.serve({
      port: 3000,
      idleTimeout: Metadata.TIMEOUT,
      fetch: app.fetch,
    });
  }
  export function stop() {
    server.stop();
  }
}

app.use(
  "/static/*",
  serveStatic({
    root: "./",
    onNotFound: (path, c) => {
      Logger.warn(`${path} is not found, you access ${c.req.path}`);
    },
  }),
);

app.get("*", Templates.layoutPage);

app.get("/", (c) => c.render(Templates.mainPage));

app.onError((error, c) => {
  Logger.error("api error", error);
  return c.text("Api error", 500);
});

app.get("/api/health", (c) => {
  return health();
});

app.notFound((c) => {
  return not_found();
});

app.post("/api/jobs/text", async (c) => {
  return text_to_text();
});

app.get("/api/jobs/images", async (c) => {
  return text_to_image();
});

app.post("/api/jobs/images", async (c) => {
  return text_to_image();
});

app.post("/api/jobs/scenes", async (c) => {
  return script_to_scenes();
});

app.post("/api/jobs/videos", async (c) => {
  return text_to_image_to_video();
});

app.get("/api/jobs/videos/compose", async (c) => {
  return compose_video();
});

app.post("/api/jobs/videos/transition", async (c) => {
  return video_transition();
});

app.post("/api/jobs/tts", async (c) => {
  return text_to_speech();
});

app.post("/api/jobs/instrumental", async (c) => {
  return text_to_instrumental();
});

app.get("/api/jobs/list", async (c) => {
  return c.html(await list_jobs());
});

app.get("/api/jobs/detail", async (c) => {
  const jobId = c.req.query("jobId");
  if (!jobId) {
    return c.text("No job selected", 400);
  }
  return c.html(Templates.jobDetailFragment(jobId));
});

app.route("/fragment", fragmentRoutes);
