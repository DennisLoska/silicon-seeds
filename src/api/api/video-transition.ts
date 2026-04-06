import { JobMode } from "../../events/events";
import { ImageGenerator } from "../../image/image-generator";
import { JobOrchestrator } from "../../jobs/jobs";

export async function video_transition() {
  const { id: jobId } = await JobOrchestrator.create_job();

  ImageGenerator.schedule_image({
    jobId,
    mode: JobMode.Video,
    prompt: "an image of hell on earth",
  });

  ImageGenerator.schedule_image({
    jobId,
    mode: JobMode.Video,
    prompt: "an image of heaven on earth",
  });

  return new Response(JSON.stringify({ message: "todo" }));
}
