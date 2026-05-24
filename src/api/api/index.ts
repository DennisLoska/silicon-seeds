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
import { delete_job } from "./delete";
import { cancel_job } from "./cancel";
import { regenerate_event } from "./regenerate";
import { zValidator } from "@hono/zod-validator";
import { PostComposeSchema, PostTextToImageSchema } from "../schemas";

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

app.post("/jobs/scenes", async () => {
  return script_to_scenes();
});

app.post("/jobs/videos", async () => {
  return text_to_image_to_video();
});

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

export default app;
