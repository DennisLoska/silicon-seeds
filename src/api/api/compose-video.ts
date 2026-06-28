import { AudioGenerator } from "../../audio/audio-generator";
import { JobOrchestrator } from "../../jobs/jobs";
import { Metadata } from "../../meta/meta";
import { TextGenerator } from "../../text/text-generator";
import { Utils } from "../../utils/utils";
import { PostCompose } from "../schemas";

export async function compose_video(options: PostCompose) {
  const {
    script,
    script_file,
    style_preset,
    fps,
    resolution,
    clip_duration,
    transition_duration,
    image_model,
    video_model,
  } = options;

  // Determine the final script: file takes precedence over text input
  let finalScript = script ? Utils.sanitizeInputText(script) : undefined;

  if (script_file) {
    // Read the uploaded file content
    const fileContent = await script_file.text();
    finalScript = Utils.sanitizeInputText(fileContent);
  }

  if (!finalScript || finalScript.length < 3) {
    return new Response(JSON.stringify({ error: "Script is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id: jobId } = await JobOrchestrator.create_job({
    original_prompt: finalScript,
    fps,
    resolution,
    clip_duration,
    transition_duration,
    image_model,
    video_model,
    audio_model: Metadata.INSTRUMENTAL_MODEL,
    style_preset,
  });

  await TextGenerator.create_text_event(jobId, finalScript);

  await AudioGenerator.schedule_audio({
    jobId,
    prompt: finalScript,
  });

  return new Response(JSON.stringify({ message: "job queued" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "HX-Redirect": `/compose?show_progress=true&job_id=${jobId}`,
    },
  });
}
