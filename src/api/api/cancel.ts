import { comfyClient } from "../../comfyui/comfyui-client";
import { DB } from "../../db/db";
import { JobLifecycleStatus } from "../../events/events";
import { Logger } from "../../logger/logger";
import { QueueManager } from "../../queue/queue-manager";
import { Templates } from "../../templates/templates";
import { Context } from "hono";

type CancelJobContext = {
  source?: string;
  filter?: string;
  tab?: string;
};

async function renderCancelResponse(c: Context, jobId: string, context: CancelJobContext) {
  if (context.source === "compose") {
    return c.html(await Templates.Compose({ showProgress: true, jobId }));
  }

  if (context.source === "image") {
    return c.html(await Templates.DistinctImage({ showProgress: true, jobId }));
  }

  const job = await DB.Jobs.findById(jobId);
  const filter = context.filter ?? "all";
  const tab = context.tab ?? "status";

  return c.html(await Templates.JobsFragment({ jobId: job.id, filter, tab }));
}

export async function cancel_job(
  c: Context,
  jobId: string,
  context: CancelJobContext,
) {
  const result = await DB.Jobs.cancelJob(jobId);
  const wasActive = result.job.status === JobLifecycleStatus.Active;

  if (wasActive && result.runningPromptId) {
    QueueManager.holdForComfyIdle();
  }

  if (result.pendingPromptIds.length > 0) {
    try {
      await comfyClient.deleteQueuedPrompts(result.pendingPromptIds);
    } catch (error) {
      Logger.error("Failed to delete queued ComfyUI prompts", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (result.runningPromptId) {
    try {
      await comfyClient.interruptPrompt(result.runningPromptId);
    } catch (error) {
      Logger.error("Failed to interrupt running ComfyUI prompt", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      QueueManager.releaseComfyIdle();
    }
  }

  if (wasActive && !result.runningPromptId) {
    void QueueManager.pump();
  }

  return renderCancelResponse(c, jobId, context);
}
