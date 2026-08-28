import { comfyClient } from "../../comfyui/comfyui-client";
import { DB } from "../../db/db";
import { JobLifecycleStatus } from "../../events/events";
import { Logger } from "../../logger/logger";
import { QueueManager } from "../../queue/queue-manager";
import { Context } from "hono";

export async function cancel_job(c: Context, jobId: string, _context: { source?: string; filter?: string; tab?: string }) {
  const result = await DB.Jobs.cancelJob(jobId);
  const wasActive = result.job.status === JobLifecycleStatus.Active;
  if (wasActive && result.runningPromptId) QueueManager.holdForComfyIdle();
  if (result.pendingPromptIds.length > 0) {
    try { await comfyClient.deleteQueuedPrompts(result.pendingPromptIds); } catch (e) { Logger.error("Failed to delete queued prompts", { jobId, error: String(e) }); }
  }
  if (result.runningPromptId) {
    try { await comfyClient.interruptPrompt(result.runningPromptId); } catch (e) { Logger.error("Failed to interrupt", { jobId, error: String(e) }); QueueManager.releaseComfyIdle(); }
  }
  if (wasActive && !result.runningPromptId) void QueueManager.pump();
  return c.json({ success: true, jobId });
}
