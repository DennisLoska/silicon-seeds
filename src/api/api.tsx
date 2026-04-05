import { Hono } from "hono";
import { list_jobs } from "./jobs/list";
import { text_to_image } from "./jobs/text-to-image";
import { delete_job } from "./jobs/delete";
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
import eventsRoutes from "./events";
import dashboardRoutes from "./dashboard";
import settingsRoutes from "./settings";
import listViewRoutes from "./jobs/list-view";
import { Context } from "hono";

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

function renderFragment(
  c: Context,
  fragment: any,
  jobId?: string,
  page?: string,
) {
  // If it's an HTMX request, just return the fragment
  if (c.req.header("HX-Request")) {
    return c.html(fragment);
  }

  // Otherwise, wrap it in the full application layout for a browser load
  return c.html(Templates.layoutPage(Templates.app(fragment, jobId, page)));
}

app.use("/static/*", async (c, next) => {
  await next();
  if (c.res.ok) {
    // c.res.headers.set("Cache-Control", "public, max-age=3600");
  }
});

app.use(
  "/static/*",
  serveStatic({
    root: "./",
    onNotFound: (path, c) => {
      Logger.warn(`${path} is not found, you access ${c.req.path}`);
    },
  }),
);

app.use(async (c, next) => {
  c.setRenderer((content) => {
    return c.html(Templates.layoutPage(content));
  });

  await next();
});

// Smart Root Route
app.get("/", async (c) => {
  const jobId = c.req.query("job_id") ?? null;
  const tab = c.req.query("tab") ?? "status";
  const page = c.req.query("page");

  if (jobId) {
    return renderFragment(
      c,
      await Templates.jobDetailFragment(jobId, tab),
      jobId,
      "job",
    );
  } else if (page === "dashboard") {
    return renderFragment(c, Templates.dashboardFragment(), undefined, page);
  } else if (page === "jobs") {
    return renderFragment(
      c,
      await Templates.jobListFragment(),
      undefined,
      page,
    );
  } else if (page === "settings") {
    return renderFragment(c, Templates.settingsFragment(), undefined, page);
  } else {
    return renderFragment(c, Templates.notSelectedFragment(), undefined);
  }
});

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

app.get("/api/jobs/text", async (c) => {
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

app.post("/api/jobs/videos/compose", async (c) => {
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
  const jobId = c.req.query("current_id");
  const list = await list_jobs(jobId);
  return c.html(list);
});

// Delete job endpoint - RESTful: DELETE /api/jobs/:job_id
app.delete("/api/jobs/:job_id", async (c) => {
  const jobId = c.req.param("job_id");
  return delete_job(jobId);
});

app.route("/api/dashboard", dashboardRoutes);
app.route("/api/settings/page", settingsRoutes);
app.route("/api/jobs/list-view", listViewRoutes);
app.route("/api/fragment", fragmentRoutes);
app.route("/api/events", eventsRoutes);
