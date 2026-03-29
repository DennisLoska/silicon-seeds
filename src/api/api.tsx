import { Hono } from "hono";
import { list as list_jobs } from "./jobs/list";
import { Metadata } from "../meta/meta";

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

app.get("/", async (c) => {
  const url = new URL(c.req.url);

  // Try to serve static file from public/
  let filePath = `public${url.pathname}`;

  // If path is root, serve index.html
  if (url.pathname === "/") {
    filePath = "public/index.html";
  }

  const file = Bun.file(filePath);
  const exists = await file.exists();

  if (exists) {
    return new Response(file);
  }

  return new Response("Not found", { status: 404 });
});

// Health check endpoint
app.get("/api/health", (c) => {
  return c.text("OK");
});

// Message endpoint
app.post("/api/message", async (c) => {
  const body = await c.req.json();
  return c.text(body.message);
});

// Jobs images endpoint
app.post("/api/jobs/images", async (c) => {
  return c.text("Images created");
});

// Jobs scenes endpoint
app.post("/api/jobs/scenes", async (c) => {
  return c.text("Scenes created");
});

// Jobs videos endpoint
app.post("/api/jobs/videos", async (c) => {
  return c.text("Videos created");
});

// Jobs videos compose endpoint
app.post("/api/jobs/videos/compose", async (c) => {
  return c.text("Video composed");
});

// Jobs videos transition endpoint
app.post("/api/jobs/videos/transition", async (c) => {
  return c.text("Transition created");
});

// Jobs TTS endpoint
app.post("/api/jobs/tts", async (c) => {
  return c.text("TTS created");
});

// Jobs instrumental endpoint
app.post("/api/jobs/instrumental", async (c) => {
  return c.text("Instrumental created");
});

// Jobs list endpoint with JSX
app.get("/api/jobs/list", async (c) => {
  const jobs = await list_jobs();
  return c.html(jobs);
});
