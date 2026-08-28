import { Hono } from "hono";
import { Utils } from "../utils/utils";
import { Metadata } from "../meta/meta";
import { Templates } from "../templates/templates";
import { not_found } from "./not_found";
import { Logger } from "../logger/logger";
import apiRoutes from "./api/index";
import fragmentRoutes from "./fragments";
import dashboardRoutes from "./dashboard";
import settingsRoutes from "./settings";
import composeRoutes from "./compose";
import jobsRoutes from "./jobs/jobs";
import galleryRoutes from "./gallery";
import createRoutes from "./create";
import { Context } from "hono";
import { JSX } from "hono/jsx/jsx-runtime";

const { Layout, App, Dashboard, OobHeader } = Templates;

const app = new Hono();

export namespace ApiServer {
  let server: Bun.Server<undefined>;
  const MAX_REQUEST_BODY_SIZE = 1024 * 1024 * 1024;

  export function start() {
    server = Bun.serve({
      port: 3000,
      idleTimeout: Metadata.TIMEOUT,
      maxRequestBodySize: MAX_REQUEST_BODY_SIZE,
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

function isCompressibleContentType(ct: string): boolean {
  return (
    ct.startsWith("text/") ||
    ct === "application/json" ||
    ct === "application/javascript" ||
    ct === "text/css" ||
    ct === "image/svg+xml"
  );
}

// Serve static files with caching, ETag, and compression
app.use("/static/*", async (c) => {
  const filePath = `.${c.req.path}`;
  const file = Bun.file(filePath);
  if (await file.exists()) {
    const contentType =
      filePath.endsWith(".css")
        ? "text/css; charset=utf-8"
        : filePath.endsWith(".js")
          ? "application/javascript; charset=utf-8"
          : Utils.getContentType(filePath);
    const stats = await file.stat();
    const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
    const ifNoneMatch = c.req.header("If-None-Match");
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: { ETag: etag, "Cache-Control": "public, max-age=3600, must-revalidate", Vary: "Accept-Encoding" },
      });
    }
    const acceptEnc = c.req.header("Accept-Encoding") || "";
    const shouldCompress = acceptEnc.includes("gzip") && isCompressibleContentType(contentType) && stats.size > 1024;
    if (shouldCompress) {
      const buf = await file.arrayBuffer();
      const compressed = Bun.gzipSync(Buffer.from(buf));
      return new Response(compressed as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": compressed.length.toString(),
          "Cache-Control": "public, max-age=3600, must-revalidate",
          ETag: etag,
          Vary: "Accept-Encoding",
          "Content-Encoding": "gzip",
          "Accept-Ranges": "bytes",
        },
      });
    }
    return new Response(file as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, must-revalidate",
        ETag: etag,
        Vary: "Accept-Encoding",
        "Accept-Ranges": "bytes",
      },
    });
  }
  Logger.warn(`${filePath} is not found, you access ${c.req.path}`);
  return c.text("Not found", 404);
});

// Serve Vite client assets first (dist/client/assets/*) before falling back to OUTPUT_DIR
app.use("/assets/*", async (c, next) => {
  // Try Vite built assets at dist/client/assets
  const vitePath = `dist/client${c.req.path}`;
  const viteFile = Bun.file(vitePath);
  if (await viteFile.exists()) {
    const contentType = Utils.getContentType(vitePath);
    const stats = await viteFile.stat();
    const etag = `"${stats.size}-${stats.mtime.getTime()}"`;
    const ifNoneMatch = c.req.header("If-None-Match");
    if (ifNoneMatch === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "public, max-age=31536000, immutable" } });
    }
    return new Response(viteFile as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
        "Accept-Ranges": "bytes",
      },
    });
  }
  await next();
});

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
        const buffer = (await file.arrayBuffer()).slice(start, end + 1);

        return new Response(buffer, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": contentLength.toString(),
            "Content-Range": `bytes ${start}-${end}/${stats.size}`,
            "Cache-Control": "public, max-age=31536000, immutable",
            ETag: etag,
            "Accept-Ranges": "bytes",
            Vary: "Accept-Encoding",
          },
        });
      }
    }

    // Full content — compress only compressible types and when no Range
    const acceptEnc = c.req.header("Accept-Encoding") || "";
    if (acceptEnc.includes("gzip") && isCompressibleContentType(contentType)) {
      const buf = await file.arrayBuffer();
      if (buf.byteLength > 1024) {
        const compressed = Bun.gzipSync(Buffer.from(buf));
        return new Response(compressed as unknown as BodyInit, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Length": compressed.length.toString(),
            "Cache-Control": "public, max-age=31536000, immutable",
            ETag: etag,
            "Accept-Ranges": "bytes",
            Vary: "Accept-Encoding",
            "Content-Encoding": "gzip",
          },
        });
      }
    }
    return new Response(file as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
        "Accept-Ranges": "bytes",
        Vary: "Accept-Encoding",
      },
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

app.route("/api", apiRoutes);
app.route("/jobs", jobsRoutes);
app.route("/dashboard", dashboardRoutes);
app.route("/compose", composeRoutes);
app.route("/settings", settingsRoutes);
app.route("/gallery", galleryRoutes);
app.route("/create", createRoutes);
app.route("/api/fragments", fragmentRoutes);

// SPA fallback: serve built SolidJS index.html for non-API, non-asset routes when it exists
app.use("/*", async (c, next) => {
  const accept = c.req.header("Accept") || "";
  const isApi = c.req.path.startsWith("/api/") || c.req.path.startsWith("/assets/") || c.req.path.startsWith("/static/") || c.req.path.startsWith("/jobs/stream");
  if (!isApi) {
    const viteIndex = Bun.file("dist/client/index.html");
    if (await viteIndex.exists() && (accept.includes("text/html") || c.req.path === "/" || !c.req.path.includes("."))) {
      const html = await viteIndex.text();
      return c.html(html);
    }
  }
  await next();
});

app.notFound((c) => {
  return not_found();
});
