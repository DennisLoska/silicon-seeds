import { Hono } from "hono";
import { health } from "../health";
import { text_to_text } from "./text-to-text";
import { text_to_image } from "./text-to-image";
import { script_to_scenes } from "./script-to-scenes";
import { text_to_image_to_video } from "./text-to-image-to-video";
import { compose_video } from "./compose-video";
import { video_transition } from "./video-transition";
import { text_to_speech } from "./text-to-speech";
import { text_to_instrumental } from "./text-to-instrumental";
import { text_to_audio } from "./text-to-audio";
import { autocut_video } from "./autocut-video";
import { delete_job } from "./delete";
import { cancel_job } from "./cancel";
import { regenerate_event } from "./regenerate";
import { zValidator } from "@hono/zod-validator";
import {
  PostComposeSchema,
  PostDistinctAudioSchema,
  PostAutoCutSchema,
  PostTextToImageSchema,
  PostHypercutSchema,
} from "../schemas";
import {
  post_hypercut,
  get_suggestions,
  accept_suggestion,
  reject_suggestion,
  render_job,
  get_composition,
  save_composition,
  add_suggestion_to_composition,
} from "./hypercut";
import { handleAgentChat } from "./agent";

const app = new Hono();

app.get("/health", () => {
  return health();
});

app.get("/jobs/text", async () => {
  return text_to_text();
});

app.post(
  "/jobs/images",
  zValidator("form", PostTextToImageSchema),
  async (c) => {
    const body = c.req.valid("form");
    return text_to_image(body);
  },
);

app.post(
  "/jobs/audio",
  zValidator("form", PostDistinctAudioSchema),
  async (c) => {
    const body = c.req.valid("form");
    return text_to_audio(body);
  },
);

app.post("/jobs/scenes", async () => {
  return script_to_scenes();
});

app.post("/jobs/videos", async () => {
  return text_to_image_to_video();
});

app.post(
  "/jobs/videos/autocut",
  zValidator("form", PostAutoCutSchema),
  async (c) => {
    const body = c.req.valid("form");
    return autocut_video(body);
  },
);

app.post(
  "/jobs/videos/compose",
  zValidator("form", PostComposeSchema),
  async (c) => {
    const body = c.req.valid("form");

    return compose_video(body);
  },
);

app.post("/jobs/videos/transition", async () => {
  return video_transition();
});

app.post("/jobs/tts", async () => {
  return text_to_speech();
});

app.post("/jobs/instrumental", async () => {
  return text_to_instrumental();
});

// Delete job endpoint - RESTful: DELETE /api/jobs/:job_id
app.delete("/jobs/:job_id", async (c) => {
  const jobId = c.req.param("job_id");
  return delete_job(c, jobId, {
    source: c.req.query("source") ?? undefined,
    filter: c.req.query("filter") ?? undefined,
    tab: c.req.query("tab") ?? undefined,
  });
});

app.post("/jobs/:job_id/cancel", async (c) => {
  const jobId = c.req.param("job_id");
  return cancel_job(c, jobId, {
    source: c.req.query("source") ?? undefined,
    filter: c.req.query("filter") ?? undefined,
    tab: c.req.query("tab") ?? undefined,
  });
});

app.post("/jobs/:job_id/events/:event_id/regenerate", async (c) => {
  const jobId = c.req.param("job_id");
  const eventId = c.req.param("event_id");
  return regenerate_event(c, jobId, eventId);
});

app.post(
  "/jobs/hypercut",
  zValidator("form", PostHypercutSchema),
  async (c) => {
    const body = c.req.valid("form");
    return post_hypercut(body);
  },
);

app.get("/jobs/hypercut/:job_id/suggestions", async (c) => {
  return get_suggestions(c.req.param("job_id"));
});

app.post("/jobs/hypercut/suggestions/:id/accept", async (c) => {
  return accept_suggestion(c.req.param("id"));
});

app.post("/jobs/hypercut/suggestions/:id/reject", async (c) => {
  return reject_suggestion(c.req.param("id"));
});

app.post("/jobs/hypercut/:job_id/render", async (c) => {
  return render_job(c.req.param("job_id"));
});

// Composition HTML endpoints (used by @hyperframes/studio iframe)
app.get("/composition/:job_id", async (c) => {
  return get_composition(c.req.param("job_id"));
});

app.post("/composition/:job_id", async (c) => {
  const body = await c.req.json();
  return save_composition(c.req.param("job_id"), body);
});

app.post("/composition/:job_id/add-suggestion", async (c) => {
  const body = await c.req.json();
  return add_suggestion_to_composition(c.req.param("job_id"), body);
});

// @hyperframes/studio expects composition at /api/projects/:id/preview
app.get("/projects/:job_id/preview", async (c) => {
  return get_composition(c.req.param("job_id"));
});

// Agent chat endpoint — SSE stream
app.post("/hypercut/:job_id/chat", async (c) => {
  return handleAgentChat(c.req.param("job_id"), c);
});

// Preview server management — spawns npx hyperframes preview for the composition
import { HypercutPreviewManager } from "../../hypercut/preview-manager";

app.get("/hypercut/:job_id/preview", async (c) => {
  const jobId = c.req.param("job_id");
  const outputDir = Bun.env.OUTPUT_DIR;
  if (!outputDir) return c.json({ error: "OUTPUT_DIR not configured" }, 500);

  const projectDir = `${outputDir}/hypercut-${jobId}`;
  try {
    const port = await HypercutPreviewManager.start(jobId, projectDir);
    return c.json({ url: `http://127.0.0.1:${port}/` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 500);
  }
});

export default app;
