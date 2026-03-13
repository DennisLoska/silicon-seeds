import { JobMode } from "../../events/events";
import { ImageGenerator } from "../../image/image-generator";
import { JobOrchestrator } from "../../jobs/jobs";
import { Metadata } from "../../meta/meta";

export async function video_transition() {
  const { id: jobId } = await JobOrchestrator.create_job();

  const id1 = Metadata.randomId();
  ImageGenerator.schedule_image({
    id: id1,
    jobId,
    mode: JobMode.Video,
    prompt: "an image of hell on earth",
  });

  const id2 = Metadata.randomId();
  ImageGenerator.schedule_image({
    id: id2,
    jobId,
    mode: JobMode.Video,
    prompt: "an image of heaven on earth",
  });

  return new Response(JSON.stringify({ message: "todo" }));
}
