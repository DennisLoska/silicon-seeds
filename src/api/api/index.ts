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

const app = new Hono();

app.get("/health", (c) => {
  return health();
});

app.get("/jobs/text", async (c) => {
  return text_to_text();
});

app.get("/jobs/images", async (c) => {
  return text_to_image();
});

app.post("/jobs/images", async (c) => {
  return text_to_image();
});

app.post("/jobs/scenes", async (c) => {
  return script_to_scenes();
});

app.post("/jobs/videos", async (c) => {
  return text_to_image_to_video();
});

app.get("/jobs/videos/compose", async (c) => {
  return compose_video();
});

app.post("/jobs/videos/compose", async (c) => {
  return compose_video();
});

app.post("/jobs/videos/transition", async (c) => {
  return video_transition();
});

app.post("/jobs/tts", async (c) => {
  return text_to_speech();
});

app.post("/jobs/instrumental", async (c) => {
  return text_to_instrumental();
});

// Delete job endpoint - RESTful: DELETE /api/jobs/:job_id
app.delete("/jobs/:job_id", async (c) => {
  const jobId = c.req.param("job_id");
  return delete_job(jobId);
});

export default app;
