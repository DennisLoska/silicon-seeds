import { AudioGenerator } from "../../audio/audio-generator";
import { JobMode } from "../../events/events";
import { JobOrchestrator } from "../../jobs/jobs";
import { PromptGenerator } from "../../prompts/prompt-generator";
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
    fps,
    resolution,
    clip_duration,
    transition_duration,
    image_model,
    video_model,
    style_preset,
  });

  await TextGenerator.create_text_event(jobId, finalScript);

  await AudioGenerator.schedule_audio({
    jobId,
    prompt: finalScript,
  });

  return new Response(
    JSON.stringify({ message: "job queued" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "HX-Redirect": `/compose?show_progress=true&job_id=${jobId}`,
      },
    },
  );
}
