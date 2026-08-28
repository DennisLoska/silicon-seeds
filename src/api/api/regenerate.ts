import { Context } from "hono";
import { RegenerationService } from "../../jobs/regeneration";
export async function regenerate_event(c: Context, jobId: string, eventId: string) {
  await RegenerationService.regenerate(jobId, eventId);
  return c.json({ success: true, jobId, eventId });
}
