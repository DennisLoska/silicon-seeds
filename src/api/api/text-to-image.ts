import { DB } from "../../db/db";
import { JobMode } from "../../events/events";
import { JobOrchestrator } from "../../jobs/jobs";
import { PromptGenerator } from "../../prompts/prompt-generator";
import { QueueManager } from "../../queue/queue-manager";
import { Utils } from "../../utils/utils";
import { PostTextToImage } from "../schemas";

export async function text_to_image(options: PostTextToImage): Promise<Response> {
  const { resolution, image_model, style_preset, batch_size } = options;
  const prompt = Utils.sanitizeInputText(options.prompt);

  if (!prompt) {
    throw new Error("Prompt is required");
  }

  const { id: jobId } = await JobOrchestrator.create_job({
    original_prompt: prompt,
    resolution,
    image_model,
    style_preset,
  });

  const batchSize = batch_size ?? 1;
  const scheduled: Awaited<ReturnType<typeof PromptGenerator.styled_img_to_event>>[] = [];

  QueueManager.hold();
  try {
    for (let index = 0; index < batchSize; index++) {
      const event = await PromptGenerator.styled_img_to_event(
        jobId,
        JobMode.Image,
        prompt,
        style_preset,
        index,
      );
      scheduled.push(event);
    }
  } finally {
    QueueManager.release();
  }

  if (scheduled.some((event) => !event)) {
    await DB.Jobs.failJob(jobId);
    throw new Error("Failed to schedule one or more image events");
  }

  void QueueManager.pump();

  return new Response(JSON.stringify({ message: "job queued" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "HX-Redirect": `/create/image?show_progress=true&job_id=${jobId}`,
    },
  });
}
