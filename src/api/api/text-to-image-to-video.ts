import { DB } from "../../db/db";
import { JobMode } from "../../events/events";
import { JobOrchestrator } from "../../jobs/jobs";
import { PromptGenerator } from "../../prompts/prompt-generator";
import { Presets } from "../../styles/presets";

export async function text_to_image_to_video() {
  // TODO get the these from query parameters
  const prompt = "A sermon about the parable of the Sower.";

  const { id: jobId } = await JobOrchestrator.create_job({});

  const scheduled = await PromptGenerator.styled_img_to_event(
    jobId,
    JobMode.Video,
    prompt,
    Presets.WATERCOLOR,
  );

  if (!scheduled) {
    await DB.Jobs.failJob(jobId);
    throw new Error("Failed to schedule image event");
  }

  return new Response(JSON.stringify({ message: "job queued" }));
}
