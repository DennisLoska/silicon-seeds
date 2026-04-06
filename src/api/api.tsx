import { Hono } from "hono";
import { Utils } from "../utils/utils";
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
import jobsRoutes from "./jobs/jobs";
import { Context } from "hono";
import { JSX } from "hono/jsx/jsx-runtime";

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

export namespace Api {
  export function renderFragment(
    c: Context,
    Fragment: JSX.Element,
    page?: string,
    OobElement?: JSX.Element,
  ) {
    if (!c.req.header("HX-Request")) {
      return c.html(Templates.layoutPage(Templates.app(Fragment, page)));
    }

    // If it's an HTMX request, just return the fragment
    if (!OobElement) {
      return c.html(Fragment);
    }

    return c.html(
      <>
        {Fragment}
        {OobElement}
      </>,
    );
  }
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

// Serve media files under /assets/*
// Files are stored in OUTPUT_DIR/<filename>, so we serve them at /assets/<filename>
// Custom handler strips the /assets/ prefix before serving
app.use("/assets/*", async (c) => {
  const pathAfterAssets = c.req.path.replace("/assets", "");
  const filePath = `${Bun.env.OUTPUT_DIR}${pathAfterAssets}`;
  const file = Bun.file(filePath);

  if (await file.exists()) {
    const contentType = Utils.getContentType(filePath);
    // Get file stats for ETag
    const stats = await file.stat();
    const etag = `"${stats.size}-${stats.mtime.getTime()}"`;

    // Check for conditional request
    const ifNoneMatch = c.req.header("If-None-Match");
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }

    // Get range header for partial content
    const range = c.req.header("Range");
    if (range) {
      // Parse range header (format: "bytes=start-end")
      const match = range.match(/bytes=(\d+)-(\d+)/);
      if (match) {
        const start = parseInt(match[1]);
        const end = parseInt(match[2]) || stats.size - 1;
        const contentLength = end - start + 1;

        // Read partial content
        const buffer = await file.bytes(start, end + 1);

        return new Response(buffer, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": contentLength.toString(),
            "Content-Range": `bytes ${start}-${end}/${stats.size}`,
            "Cache-Control": "public, max-age=31536000, immutable",
            ETag: etag,
          },
        });
      }
    }

    // Full content
    return c.body(await file.arrayBuffer(), 200, {
      "Content-Type": contentType,
      "Content-Length": stats.size.toString(),
      "Cache-Control": "public, max-age=31536000, immutable", // Cache for 1 year
      ETag: etag,
    });
  }

  Logger.warn(`${filePath} is not found, you access ${c.req.path}`);
  return c.text("Not found", 404);
});

app.use(async (c, next) => {
  c.setRenderer((content) => {
    return c.html(Templates.layoutPage(content));
  });

  await next();
});

// Smart Root Route
app.get("/", async (c) => {
  return Api.renderFragment(
    c,
    Templates.Dashboard,
    "dashboard",
    Templates.oobHeader("Dashboard"),
  );
});

app.onError((error, c) => {
  Logger.error("[API] error", error);
  return c.json(
    {
      name: error.name,
      message: error.message,
    },
    500,
  );
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

// Delete job endpoint - RESTful: DELETE /api/jobs/:job_id
app.delete("/api/jobs/:job_id", async (c) => {
  const jobId = c.req.param("job_id");
  return delete_job(jobId);
});

// pages
app.route("/jobs", jobsRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/settings", settingsRoutes);

app.route("/api/fragment", fragmentRoutes);
app.route("/api/events", eventsRoutes);
