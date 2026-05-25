import { AutoCutWorkflow } from "../../autocut/autocut-workflow";
import { PostAutoCut } from "../schemas";

export async function autocut_video(options: PostAutoCut) {
  const { video_file, generate_insert_clips } = options;
  const { jobId } = await AutoCutWorkflow.enqueue(video_file, {
    generateInsertClips: generate_insert_clips,
  });

  return new Response(JSON.stringify({ message: "autocut queued" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "HX-Redirect": `/create/autocut?show_progress=true&job_id=${jobId}`,
    },
  });
}
