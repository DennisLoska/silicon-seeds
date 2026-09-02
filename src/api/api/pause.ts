import { comfyClient } from "../../comfyui/comfyui-client";
import { DB } from "../../db/db";
import { JobLifecycleStatus } from "../../events/events";
import { Logger } from "../../logger/logger";
import { QueueManager } from "../../queue/queue-manager";
import { Context } from "hono";

export async function pause_job(c: Context, jobId: string) {
  try {
    const result = await DB.Jobs.pauseJob(jobId);
    const wasActive = result.job.status === JobLifecycleStatus.Active || result.job.status === JobLifecycleStatus.Paused;
    if (result.runningPromptId) QueueManager.holdForComfyIdle();
    if (result.pendingPromptIds.length > 0) {
      try {
        await comfyClient.deleteQueuedPrompts(result.pendingPromptIds);
      } catch (e) {
        Logger.error("Failed to delete queued prompts", { jobId, error: String(e) });
      }
    }
    if (result.runningPromptId) {
      try {
        await comfyClient.interruptPrompt(result.runningPromptId);
      } catch (e) {
        Logger.error("Failed to interrupt", { jobId, error: String(e) });
        QueueManager.releaseComfyIdle();
      }
    }
    // wasActive not needed for pause, pump is held until resumed
    void wasActive;
    return c.json({ success: true, jobId, status: "paused" });
  } catch (e: any) {
    const status = e.status ?? 500;
    if (status === 409) return c.json({ error: e.message }, 409);
    if (e.message?.includes("not found") || e.message?.includes("no result")) return c.json({ error: "job not found" }, 404);
    throw e;
  }
}
