import { AudioGenerator } from "../../audio/audio-generator";
import { JobOrchestrator } from "../../jobs/jobs";
import { Metadata } from "../../meta/meta";

export async function text_to_instrumental() {
  // TODO get the these from query parameters
  const duration = 120;
  const prompt = undefined;

  const { id: jobId } = await JobOrchestrator.create_job({
    audio_model: Metadata.INSTRUMENTAL_MODEL,
  });
  await AudioGenerator.schedule_audio({ jobId, duration, prompt });

  return new Response(JSON.stringify({ message: "job queued", jobId }), {
    status: 202,
  });
}
