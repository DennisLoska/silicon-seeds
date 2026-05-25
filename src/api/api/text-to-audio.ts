import { AudioGenerator } from "../../audio/audio-generator";
import { JobOrchestrator } from "../../jobs/jobs";
import { JobMode } from "../../events/events";
import { Utils } from "../../utils/utils";
import { PostDistinctAudio } from "../schemas";

export async function text_to_audio(options: PostDistinctAudio): Promise<Response> {
  const instrumentalPrompt = Utils.sanitizeInputText(options.instrumental_prompt);
  const lyricPrompt = Utils.sanitizeInputText(options.lyric_prompt);

  if (!instrumentalPrompt) {
    throw new Error("Instrumental prompt is required");
  }

  if (!lyricPrompt) {
    throw new Error("Lyric prompt is required");
  }

  const { id: jobId } = await JobOrchestrator.create_job({
    original_prompt: instrumentalPrompt,
  });

  await AudioGenerator.schedule_audio({
    jobId,
    mode: JobMode.Song,
    prompt: instrumentalPrompt,
    lyrics: lyricPrompt,
    duration: options.duration,
    audio_settings: {
      bpm: options.bpm,
      cfg_scale: options.cfg_scale,
      temperature: options.temperature,
      top_p: options.top_p,
      keyscale: options.keyscale,
      timesignature: options.timesignature,
    },
  });

  return new Response(JSON.stringify({ message: "job queued" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "HX-Redirect": `/create/audio?show_progress=true&job_id=${jobId}`,
    },
  });
}
