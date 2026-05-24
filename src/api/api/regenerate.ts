import { Context } from "hono";
import { RegenerationService } from "../../jobs/regeneration";
import { Templates } from "../../templates/templates";

async function renderRegenerateResponse(
  c: Context,
  jobId: string,
  source: string,
  activeTab: string,
) {
  if (source === "compose-progress") {
    return c.html(await Templates.ComposeProgressFragment({ jobId }));
  }

  if (source === "image-progress") {
    return c.html(await Templates.DistinctImageProgressFragment({ jobId }));
  }

  if (source === "audio-progress") {
    return c.html(await Templates.DistinctAudioProgressFragment({ jobId }));
  }

  return c.html(await Templates.JobContentAreaFragment({ jobId, activeTab }));
}

export async function regenerate_event(
  c: Context,
  jobId: string,
  eventId: string,
) {
  await RegenerationService.regenerate(jobId, eventId);

  const source = c.req.query("source") ?? "jobs-events";
  const activeTab = c.req.query("tab") ?? "media";
  return renderRegenerateResponse(c, jobId, source, activeTab);
}
