import { Hono } from "hono";
import { Utils } from "../utils/utils";
import { Metadata } from "../meta/meta";
import { Templates } from "../templates/templates";
import { not_found } from "./not_found";
import { Logger } from "../logger/logger";
import { serveStatic } from "hono/bun";
import apiRoutes from "./api/index";
import fragmentRoutes from "./fragments";
import dashboardRoutes from "./dashboard";
import settingsRoutes from "./settings";
import composeRoutes from "./compose";
import jobsRoutes from "./jobs/jobs";
import { Context } from "hono";
import { JSX } from "hono/jsx/jsx-runtime";

const { Layout, App, Dashboard, OobHeader } = Templates;

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
    Fragment: () => JSX.Element,
    page?: string,
    OobElement?: () => JSX.Element,
  ) {
    if (!c.req.header("HX-Request")) {
      return c.html(
        <Layout>
          <App page={page}>
            <Fragment />
          </App>
        </Layout>,
      );
    }

    // If it's an HTMX request, just return the fragment
    if (!OobElement) {
      return c.html(<Fragment />);
    }

    return c.html(
      <>
        <Fragment />
        <OobElement />
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
    return c.html(<Layout children={content} />);
  });

  await next();
});

// Smart Root Route
app.get("/", async (c) => {
  return Api.renderFragment(c, Dashboard, "dashboard", () => (
    <OobHeader title="Dashboard" />
  ));
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

app.notFound((c) => {
  return not_found();
});

app.route("/api", apiRoutes);
app.route("/jobs", jobsRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/compose", composeRoutes);
app.route("/settings", settingsRoutes);
app.route("/api/fragments", fragmentRoutes);
