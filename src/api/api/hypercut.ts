import { DB } from "../../db/db";
import { HyperCutWorkflow } from "../../hypercut/hypercut-workflow";
import { Logger } from "../../logger/logger";
import type { PostHypercut } from "../schemas";

export async function post_hypercut(body: PostHypercut) {
  const { video_file, ...options } = body;

  const job = await HyperCutWorkflow.createJob(options);

  const videoPath = `${Bun.env.INPUT_DIR}/${job.id}-${video_file.name}`;
  await Bun.write(videoPath, await video_file.arrayBuffer());

  await DB.db
    .updateTable("jobs")
    .set({ source_video_path: videoPath })
    .where("id", "=", job.id)
    .execute();

  void HyperCutWorkflow.processUpload(job.id, videoPath).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    Logger.error("HyperCut workflow failed", { jobId: job.id, message });
    void DB.Jobs.failJob(job.id);
  });

  return new Response(JSON.stringify({ message: "job queued" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "HX-Redirect": `/create/hypercut?show_progress=true&job_id=${job.id}`,
    },
  });
}

export async function get_suggestions(jobId: string) {
  const suggestions = await DB.Hypercut.findContentSuggestionsByJob(jobId);
  return Response.json({ suggestions });
}

export async function accept_suggestion(id: string) {
  await DB.Hypercut.updateSuggestionStatus(id, "accepted");
  return new Response(null, { status: 204 });
}

export async function reject_suggestion(id: string) {
  await DB.Hypercut.updateSuggestionStatus(id, "rejected");
  return new Response(null, { status: 204 });
}

export async function render_job(jobId: string) {
  const outputDir = Bun.env.OUTPUT_DIR;
  if (!outputDir) {
    return Response.json({ error: "OUTPUT_DIR not configured" }, { status: 500 });
  }

  try {
    const outputPath = await HyperCutWorkflow.render(jobId, outputDir);
    return Response.json({ output_path: outputPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error("HyperCut render failed", { jobId, message });
    return Response.json({ error: message }, { status: 500 });
  }
}
