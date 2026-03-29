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
import { jsxRenderer } from "hono/jsx-renderer";
import { Metadata } from "../meta/meta";
import { health } from "./health";

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

// Layout renderer
app.get(
  "*",
  jsxRenderer(({ children }) => (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Silicon Seeds</title>
        <link
          href="https://cdn.jsdelivr.net/npm/daisyui@latest/dist/full.min.css"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
      </head>
      <body>{children}</body>
    </html>
  )),
);

// Main page
app.get("/", (c) =>
  c.render(
    <body class="min-h-screen bg-base-100">
      <header class="navbar bg-base-200 px-6">
        <div class="navbar-start">
          <div class="text-lg font-bold">Silicon Seeds</div>
        </div>
        <div class="navbar-end">
          <button
            class="btn btn-square"
            hx-get="/api/settings"
            hx-target="#settings-content"
            hx-swap="innerHTML"
          >
            ⚙️
          </button>
        </div>
      </header>

      <main class="flex min-h-[calc(100vh-4rem)] px-6">
        <aside class="w-64 bg-base-200 rounded-box mr-8 p-4">
          <h2 class="text-lg font-bold mb-4">Jobs</h2>
          <div
            id="job-list"
            hx-get="/api/jobs/list"
            hx-trigger="load"
            hx-swap="innerHTML"
          ></div>
        </aside>

        <section class="flex-1">
          <h1 class="text-5xl font-bold mb-4">Hello World!</h1>
          <p class="mb-6 text-lg">Silicon Seeds Health Check</p>

          <button
            class="btn btn-primary btn-lg"
            hx-get="/api/health"
            hx-target="#status-card"
            hx-swap="outerHTML"
          >
            Check Status
          </button>

          <div id="status-card" class="mt-8"></div>
        </section>
      </main>

      <div id="settings-content"></div>
    </body>,
  ),
);

// Health check endpoint
app.get("/api/health", (c) => {
  return health();
});

// Message endpoint
app.post("/api/message", async (c) => {
  const body = await c.req.json();
  return c.text(body.message);
});

// Jobs images endpoint
app.get("/api/jobs/images", async (c) => {
  return text_to_image();
});

// Jobs scenes endpoint
app.post("/api/jobs/scenes", async (c) => {
  return script_to_scenes();
});

// Jobs videos endpoint
app.post("/api/jobs/videos", async (c) => {
  return text_to_image_to_video();
});

// Jobs videos compose endpoint
app.post("/api/jobs/videos/compose", async (c) => {
  return compose_video();
});

// Jobs videos transition endpoint
app.post("/api/jobs/videos/transition", async (c) => {
  return video_transition();
});

// Jobs TTS endpoint
app.post("/api/jobs/tts", async (c) => {
  return text_to_speech();
});

// Jobs instrumental endpoint
app.post("/api/jobs/instrumental", async (c) => {
  return text_to_instrumental();
});

// Jobs list endpoint with JSX
app.get("/api/jobs/list", async (c) => {
  const jobs = await list_jobs();
  return c.html(jobs);
});
