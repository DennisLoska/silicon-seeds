import { DB } from "../../db/db";
import { Context } from "hono";
export async function delete_job(
  c: Context,
  jobId: string,
  _context: { source?: string; filter?: string; tab?: string },
) {
  await DB.Jobs.deleteById(jobId);
  return c.json({ success: true, jobId });
}
