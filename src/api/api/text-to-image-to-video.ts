import { DB } from "../../db/db";
import { JobMode } from "../../events/events";
import { JobOrchestrator } from "../../jobs/jobs";
import { PromptGenerator } from "../../prompts/prompt-generator";
import { Utils } from "../../utils/utils";
import { PostTextToVideo } from "../schemas";
import { Metadata } from "../../meta/meta";

export async function text_to_image_to_video(options: PostTextToVideo) {
  const { prompt: rawPrompt, resolution, video_model, image_model, fps, clip_duration, style_preset, style_guide } = options;
  const prompt = Utils.sanitizeInputText(rawPrompt);

  if (!prompt || prompt.length < 1) {
    return new Response(JSON.stringify({ error: "Prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Incorporate style_guide into prompt via styled generator if present, otherwise just prompt
  // PromptGenerator.styled_img_to_event handles style_preset; style_guide is extra context
  // We prepend style_guide to prompt for stronger adherence when needed
  const finalPrompt = style_guide ? `${prompt}\n\nStyle guide: ${style_guide}` : prompt;

  const { id: jobId } = await JobOrchestrator.create_job({
    original_prompt: prompt,
    fps,
    resolution,
    clip_duration,
    transition_duration: Metadata.TRANSITION_DURATION,
    image_model: image_model ?? "z-image-turbo",
    video_model,
    style_preset,
    style_guide: style_guide ?? null,
    workflow: "video",
  });

  const scheduled = await PromptGenerator.styled_img_to_event(
    jobId,
    JobMode.Video,
    finalPrompt,
    style_preset as any,
    0,
  );

  if (!scheduled) {
    await DB.Jobs.failJob(jobId);
    return new Response(JSON.stringify({ error: "Failed to schedule image event" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ message: "job queued", jobId }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "HX-Redirect": `/create/video?show_progress=true&job_id=${jobId}`,
    },
  });
}

// Backwards compat for old stub without params (not used by validated route)
export async function text_to_image_to_video_legacy() {
  return text_to_image_to_video({
    prompt: "A sermon about the parable of the Sower.",
    resolution: "480p",
    video_model: "wan2.2",
    fps: 8,
    clip_duration: 1,
    style_preset: "system" as any,
    style_guide: undefined,
  });
}
