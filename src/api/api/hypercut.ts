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

  const compPath = `${outputDir}/hypercut-${jobId}.html`;
  const file = Bun.file(compPath);
  if (!(await file.exists())) {
    const job = await DB.Jobs.findById(jobId).catch(() => null);
    if (job?.status === "failed") {
      return new Response("Job failed — composition was not generated.", { status: 404 });
    }
    return new Response("Composition not found.", { status: 404 });
  }

  let html = await file.text();
  // Hyperframes runtime requires data-duration (not data-end) for each clip.
  // Convert data-end to data-duration where needed.
  html = html.replace(
    /<([a-z]+)(?=[^>]*\bdata-start="([\d.]+)")(?=[^>]*\bdata-end="([\d]+(?:\.\d+)?)")(?![^>]*\bdata-duration=)[^>]*>/gi,
    (match, _tag, start, end) => {
      const dur = (parseFloat(end) - parseFloat(start)).toFixed(3);
      return match.replace("data-end=", `data-duration="${dur}" data-end=`);
    },
  );
  // Inject hyperframes runtime — CDN auto-inject from @hyperframes/player references
  // stale n.iife.js (404). Use local copy instead.
  if (!html.includes("hyperframe.runtime.iife")) {
    const runtimeScript = `<script src="/static/studio/hyperframe.runtime.iife.js"></script>`;
    html = html.replace("</head>", `${runtimeScript}</head>`);
  }
  // Inject timeline bridge: reads DOM clips, sets __clipManifest, sends postMessage
  // so @hyperframes/studio's NLELayout can populate the timeline UI.
  if (!html.includes("__clipManifest")) {
    const bridgeScript = `<script>
(function(){
  console.log("[hypercut-bridge] running");
  var compEl = document.querySelector('[data-composition-id]');
  if (!compEl) return;
  var dur = parseFloat(compEl.getAttribute('data-composition-duration') || '0');
  var clips = [];
  var els = document.querySelectorAll('[data-hf-id]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var id = el.getAttribute('data-hf-id');
    var start = parseFloat(el.getAttribute('data-start') || '0');
    var duration = parseFloat(el.getAttribute('data-duration') || el.getAttribute('data-end') || '0') - start;
    var name = el.getAttribute('data-name') || id;
    var track = parseInt(el.getAttribute('data-layer') || '0', 10);
    var src = el.getAttribute('src') || el.getAttribute('data-src') || '';
    var tag = el.tagName.toLowerCase();
    var kind = tag === 'video' ? 'video' : tag === 'audio' ? 'audio' : tag === 'img' ? 'image' : 'element';
    clips.push({
      id: id,
      label: name,
      start: start,
      duration: duration,
      track: track,
      kind: kind,
      tagName: tag,
      compositionId: compEl.getAttribute('data-composition-id'),
      parentCompositionId: null,
      compositionSrc: null,
      assetUrl: src || null,
    });
  }
  var manifest = { clips: clips, scenes: [], durationInFrames: Math.round(dur * 30) };
  window.__clipManifest = manifest;
  // Delay sends until the @hyperframes/studio hook's message listener is ready.
  setTimeout(function() {
    window.parent.postMessage({ source: 'hf-preview', type: 'timeline', clips: manifest.clips, durationInFrames: manifest.durationInFrames }, '*');
    window.parent.postMessage({ source: 'hf-preview', type: 'state', frame: 0, isPlaying: false }, '*');
  }, 500);
})();
</script>`;
    html = html.replace("</body>", `${bridgeScript}</body>`);
  }
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

  const compPath = `${outputDir}/hypercut-${jobId}.html`;
  await Bun.write(compPath, body.html);
  Logger.info("HyperCut composition saved", { jobId });
  return Response.json({ ok: true });
}

export async function add_suggestion_to_composition(
  jobId: string,
  body: { suggestion_id?: string; clip?: Record<string, unknown> },
) {
  const outputDir = Bun.env.OUTPUT_DIR;
  if (!outputDir) {
    return Response.json({ error: "OUTPUT_DIR not configured" }, { status: 500 });
  }

  try {
    const result = await HyperCutWorkflow.addSuggestionToComposition(
      jobId,
      outputDir,
      body.suggestion_id,
    );
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error("Failed to add suggestion to composition", { jobId, message });
    return Response.json({ error: message }, { status: 500 });
  }
}
