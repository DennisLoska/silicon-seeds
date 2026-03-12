import { JobMode } from "../../events/events";
import { ImageGenerator } from "../../image/image-generator";
import { JobOrchestrator } from "../../jobs/jobs";
import { Metadata } from "../../meta/meta";
import { VideoGenerator } from "../../video/video-generator";

export async function video_transition() {
  const { id: jobId } = await JobOrchestrator.create_job();

  const id1 = Metadata.randomId();
  ImageGenerator.schedule_image({
    id: id1,
    jobId,
    mode: JobMode.Video,
    prompt: "an image of hell on earth",
  });
  const foo = await ImageGenerator.get_image(id1);

  const id2 = Metadata.randomId();
  ImageGenerator.schedule_image({
    id: id2,
    jobId,
    mode: JobMode.Video,
    prompt: "an image of heaven on earth",
  });
  const bar = await ImageGenerator.get_image(id2);

  const metaFoo = foo?.data?.images?.[0];
  const metaBar = bar?.data?.images?.[0];
  const fileFoo = metaFoo.filename;
  const fileBar = metaBar.filename;

  VideoGenerator.schedule_transition({
    jobId,
    prompt: "todo",
    startImg: fileFoo,
    endImg: fileBar,
  });

  return new Response(JSON.stringify({ message: "todo" }));
}
