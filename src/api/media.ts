import { Hono } from "hono";
import { Templates } from "../templates/templates";
import { DB } from "../db/db";

const app = new Hono();

// Media route handler for fetching job media assets (HTMX fragment)
app.get("/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  
  // Fetch all events for this job
  const events = await DB.Events.findByJobId(jobId);
  
  // Get metadata for each event and group by mode
  const mediaData: {
    images: Array<{ filename: string; subfolder: string; type: string; status: string }>;
    videos: Array<{ filename: string; subfolder: string; type: string; status: string }>;
    audio: Array<{ filename: string; subfolder: string; type: string; status: string }>;
    pending: Array<{ mode: string; filename: string | null; status: string }>;
  } = {
    images: [],
    videos: [],
    audio: [],
    pending: [],
  };
  
  // Process each event
  for (const event of events) {
    if (event.status === "pending") {
      // Only video events have filename property
      mediaData.pending.push({
        mode: event.mode,
        filename: (event as any).filename ?? null,
        status: event.status,
      });
    } else {
      // Completed event - get metadata
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
  
  // Render the media template with the fetched data
  const job = { id: jobId, created_at: new Date().toISOString() };
  return c.html(Templates.mediaFragment(job, mediaData));
});

export default app;
