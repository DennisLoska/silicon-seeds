import { DB } from "../../db/db";
import { HyperCutWorkflow } from "../../hypercut/hypercut-workflow";
import { renderWithValidation, RenderValidationError, RenderOutputError } from "../../hypercut/render-orchestrator";
import { HypercutPreviewManager } from "../../hypercut/preview-manager";
import { Logger } from "../../logger/logger";
import { Metadata } from "../../meta/meta";
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
  const suggestion = await DB.db
    .selectFrom("hypercut_suggestions")
    .leftJoin("meta", "meta.event_id", "hypercut_suggestions.asset_id")
    .where("hypercut_suggestions.id", "=", id)
    .select([
      "hypercut_suggestions.id",
      "hypercut_suggestions.job_id",
      "hypercut_suggestions.source_type",
      "hypercut_suggestions.asset_filename",
      "hypercut_suggestions.asset_subfolder",
      "hypercut_suggestions.transcript_anchor_start",
      "hypercut_suggestions.transcript_anchor_end",
      "meta.filename as meta_filename",
      "meta.subfolder as meta_subfolder",
    ])
    .executeTakeFirst();

  await DB.Hypercut.updateSuggestionStatus(id, "accepted");

  if (!suggestion || suggestion.source_type === "autocut_cut") {
    return new Response(null, { status: 204 });
  }

  const outputDir = Bun.env.OUTPUT_DIR;
  if (!outputDir) return new Response(null, { status: 204 });

  const projectDir = `${outputDir}/hypercut-${suggestion.job_id}`;
  await HypercutPreviewManager.syncFromStudio(suggestion.job_id, projectDir);

  const compPath = `${projectDir}/index.html`;
  const file = Bun.file(compPath);
  if (!(await file.exists())) return new Response(null, { status: 204 });

  const filename = suggestion.asset_filename ?? suggestion.meta_filename;
  const subfolder = suggestion.asset_subfolder ?? suggestion.meta_subfolder ?? "";
  if (!filename) return new Response(null, { status: 204 });

  const baseUrl = `http://localhost:${process.env.PORT ?? 3000}`;
  const assetPath = subfolder
    ? `${baseUrl}/assets/${subfolder}/${filename}`
    : `${baseUrl}/assets/${filename}`;

  const start = suggestion.transcript_anchor_start;
  const duration = suggestion.transcript_anchor_end - suggestion.transcript_anchor_start;
  const clipId = `sugg-${id}`;

  let html = await file.text();

  if (html.includes(`id="${clipId}"`)) {
    return new Response(null, { status: 204 });
  }

  const trackMatch = html.match(/data-track-index="(\d+)"/g);
  const maxTrack = trackMatch
    ? Math.max(...trackMatch.map(m => parseInt(m.match(/\d+/)![0])))
    : 0;
  const trackIndex = maxTrack + 1;
  let clipHtml: string;
  if (suggestion.source_type === "video") {
    clipHtml = `      <video id="${clipId}" class="clip" data-start="${start}" data-duration="${duration}" data-track-index="${trackIndex}" data-name="${suggestion.source_type}" src="${assetPath}" playsinline></video>`;
  } else {
    clipHtml = `      <img id="${clipId}" class="clip" data-start="${start}" data-duration="${duration}" data-track-index="${trackIndex}" data-name="${suggestion.source_type}" src="${assetPath}" />`;
  }

  html = html.replace(/(\s*<\/div>\s*(?:<script>|<\/body>))/, `\n${clipHtml}\n$1`);

  await Bun.write(compPath, html);
  Logger.info("HyperCut: suggestion added to composition", { suggestionId: id, clipId });

  return new Response(
    `<div class="bg-base-200 rounded-box border border-success/30 p-2 text-center text-xs opacity-50">Added to timeline</div>`,
    { status: 200, headers: { "Content-Type": "text/html", "HX-Trigger": "suggestion-accepted" } },
  );
}

export async function reject_suggestion(id: string) {
  await DB.Hypercut.updateSuggestionStatus(id, "rejected");
  return new Response("", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

export async function regenerate_composition(jobId: string) {
  const job = await DB.Jobs.findById(jobId);
  if (!job || !job.source_video_path) {
    return Response.json({ error: "Job or source video not found" }, { status: 404 });
  }

  const suggestions = await DB.Hypercut.findSuggestionsByJob(jobId);
  const fillers = new Set(["um", "uh", "ah", "er", "hmm", "like"]);
  const removals = suggestions
    .filter((s) => s.source_type === "autocut_cut")
    .map((s) => ({
      start: s.transcript_anchor_start,
      end: s.transcript_anchor_end,
      text: s.text_content ?? "",
      reason: (!s.text_content || s.text_content.trim() === ""
        ? "pause"
        : fillers.has(s.text_content.toLowerCase().trim())
          ? "filler"
          : "restart") as "filler" | "pause" | "restart",
    }));

  const duration = await Metadata.getMediaDurationFromPath(job.source_video_path);
  await HyperCutWorkflow.generateInitialComposition(jobId, removals, duration);

  Logger.info("HyperCut: composition regenerated", { jobId, clips: removals.length });
  return Response.json({ ok: true, clips: removals.length });
}

export async function render_job(jobId: string) {
  const outputDir = Bun.env.OUTPUT_DIR;
  if (!outputDir) {
    return new Response(
      `<div class="alert alert-error text-sm"><span>OUTPUT_DIR not configured</span></div>`,
      { status: 500, headers: { "Content-Type": "text/html" } },
    );
  }

  try {
    const outputPath = await renderWithValidation(jobId, outputDir);
    const filename = outputPath.split("/").pop()!;
    const previewUrl = `/assets/${filename}`;
    return new Response(
      `<video src="${previewUrl}" controls class="w-full rounded-lg" preload="metadata"></video><div class="flex gap-2 mt-2"><a href="${previewUrl}" download class="btn btn-xs btn-outline btn-primary">Download</a></div>`,
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  } catch (error) {
    if (error instanceof RenderValidationError) {
      Logger.warn("HyperCut render validation failed", { jobId, findings: error.findings });
      const findingsHtml = error.findings.map(f => `<li>[${f.severity}] ${f.code}: ${f.message}</li>`).join("");
      return new Response(
        `<div class="alert alert-error text-sm"><span>Composition validation failed:</span><ul class="text-xs mt-1">${findingsHtml}</ul></div>`,
        { status: 400, headers: { "Content-Type": "text/html" } },
      );
    }
    if (error instanceof RenderOutputError) {
      Logger.error("HyperCut render output invalid", { jobId, message: error.message });
      return new Response(
        `<div class="alert alert-error text-sm"><span>${error.message}</span></div>`,
        { status: 500, headers: { "Content-Type": "text/html" } },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    Logger.error("HyperCut render failed", { jobId, message });
    return new Response(
      `<div class="alert alert-error text-sm"><span>${message}</span></div>`,
      { status: 500, headers: { "Content-Type": "text/html" } },
    );
  }
}
