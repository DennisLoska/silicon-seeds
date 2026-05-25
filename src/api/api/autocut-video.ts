import { AutoCutWorkflow } from "../../autocut/autocut-workflow";
import { PostAutoCut } from "../schemas";

export async function autocut_video(options: PostAutoCut) {
  const {
    video_file,
    generate_insert_clips,
    image_model,
    video_model,
    resolution,
    fps,
    clip_duration,
    transition_duration,
    style_preset,
  } = options;
  const { jobId } = await AutoCutWorkflow.enqueue(video_file, {
    generateInsertClips: generate_insert_clips,
    generationSettings: generate_insert_clips
      ? {
          image_model: image_model!,
          video_model: video_model!,
          resolution: resolution!,
          fps: fps!,
          clip_duration: clip_duration!,
          transition_duration: transition_duration!,
          style_preset: style_preset!,
        }
      : undefined,
  });

  return new Response(JSON.stringify({ message: "autocut queued" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "HX-Redirect": `/create/autocut?show_progress=true&job_id=${jobId}`,
    },
  });
}
