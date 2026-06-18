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

export async function get_composition(jobId: string) {
  const outputDir = Bun.env.OUTPUT_DIR;
  if (!outputDir) {
    return new Response("OUTPUT_DIR not configured", { status: 500 });
  }

  const compPath = `${outputDir}/hypercut-${jobId}/index.html`;
  const file = Bun.file(compPath);
  if (!(await file.exists())) {
    const job = await DB.Jobs.findById(jobId).catch(() => null);
    if (job?.status === "failed") {
      return new Response("Job failed — composition was not generated.", { status: 404 });
    }
    return new Response("Composition not found.", { status: 404 });
  }

  const html = await file.text();
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

export async function save_composition(jobId: string, body: { html?: string }) {
  if (!body.html) {
    return Response.json({ error: "html field required" }, { status: 400 });
  }

  const outputDir = Bun.env.OUTPUT_DIR;
  if (!outputDir) {
    return Response.json({ error: "OUTPUT_DIR not configured" }, { status: 500 });
  }

  const compPath = `${outputDir}/hypercut-${jobId}/index.html`;
  await Bun.write(compPath, body.html);
  Logger.info("HyperCut composition saved", { jobId });
  return Response.json({ ok: true });
}
