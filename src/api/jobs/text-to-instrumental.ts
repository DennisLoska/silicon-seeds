import { AudioGenerator } from "../../audio/audio-generator";
import { JobOrchestrator } from "../../jobs/jobs";
import { Logger } from "../../logger/logger";
import { Metadata } from "../../meta/meta";

export async function text_to_instrumental() {
  // TODO get the these from query parameters
  const duration = 120;
  const prompt = undefined;

  const { id: jobId } = await JobOrchestrator.create_job();
  const id = Metadata.randomId();
  AudioGenerator.schedule_audio({ id, jobId, duration, prompt });

  try {
    const res = await AudioGenerator.get_audio(id);
    const metadata = res?.data?.audio?.[0];

    return new Response(JSON.stringify({ message: { ...metadata } }));
  } catch (error) {
    Logger.error("error", error);
    return new Response(JSON.stringify({ message: "Computer says no" }), {
      status: 500,
    });
  }
}
