import { Hono } from "hono";
import { Templates } from "../templates/templates";
import { DB } from "../db/db";

const app = new Hono();

app.get("/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const events = await DB.Events.findByJobId(jobId);

  const mediaData: {
    images: Array<{
      filename: string;
      subfolder: string;
      type: string;
      status: string;
    }>;
    videos: Array<{
      filename: string;
      subfolder: string;
      type: string;
      status: string;
    }>;
    audio: Array<{
      filename: string;
      subfolder: string;
      type: string;
      status: string;
    }>;
    pending: Array<{ mode: string; filename: string | null; status: string }>;
  } = {
    images: [],
    videos: [],
    audio: [],
    pending: [],
  };

  for (const event of events) {
    if (event.status === "pending") {
      mediaData.pending.push({
        mode: event.mode,
        filename: (event as any).filename ?? null,
        status: event.status,
      });
    } else {
      const meta = await DB.Meta.findByEventId(event.id).catch(() => null);
      if (meta) {
        if (event.mode === "image") {
          mediaData.images.push({
            filename: meta.filename,
            subfolder: meta.subfolder,
            type: meta.type,
            status: event.status,
          });
        } else if (event.mode === "video") {
          mediaData.videos.push({
            filename: meta.filename,
            subfolder: meta.subfolder,
            type: meta.type,
            status: event.status,
          });
        } else if (event.mode === "speech" || event.mode === "instrumental") {
          mediaData.audio.push({
            filename: meta.filename,
            subfolder: meta.subfolder,
            type: meta.type,
            status: event.status,
          });
        }
      }
    }
  }

  return c.html(Templates.MediaFragment(mediaData));
});

export default app;
