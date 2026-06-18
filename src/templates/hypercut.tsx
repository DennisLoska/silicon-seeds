import { Icons } from "./icons";
import type { HypercutSuggestionSchema } from "../db/db";
import { AgentChat } from "./agent-chat";
import { getAssetPath } from "./utils";
export function HypercutPage() {
  return (
    <div className="p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">HyperCut</h1>
      <p className="mb-4 opacity-80">
        Upload a source video. HyperCut will transcribe it, detect filler words
        and pauses, and suggest content from your library. You decide what goes
        on the timeline.
      </p>
      <form
        hx-post="/api/jobs/hypercut"
        hx-encoding="multipart/form-data"
        hx-target="#hypercut-result"
      >
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Source video</legend>
          <input
            type="file"
            name="video_file"
            accept="video/*"
            className="file-input w-full"
            required
          />
        </fieldset>

        <fieldset className="fieldset mt-2">
          <legend className="fieldset-legend">Context (optional)</legend>
          <input
            type="text"
            name="prompt"
            placeholder="Describe the video topic"
            className="input w-full"
          />
        </fieldset>

        <button type="submit" className="btn btn-primary mt-4">
          Start HyperCut
        </button>
      </form>
      <div id="hypercut-result" className="mt-4" />
    </div>
  );
}

export function HypercutWorkspace(props: {
  jobId: string;
  sourceVideoUrl: string;
}) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">HyperCut Workspace</h1>
        <button
          id="render-btn"
          class="btn btn-primary btn-sm"
          onclick={`
            var btn = document.getElementById('render-btn');
            btn.disabled = true;
            btn.innerHTML = '<span class=\\"loading loading-spinner loading-xs\\"></span> Rendering...';
            fetch('/api/jobs/hypercut/${props.jobId}/render', { method: 'POST' })
              .then(function(r) { return r.json(); })
              .then(function(data) {
                if (data.error) {
                  btn.innerHTML = 'Render Failed';
                  document.getElementById('render-result').innerHTML = '<div class=\\"alert alert-error text-sm mb-4\\">' + data.error + '</div>';
                } else {
                  btn.innerHTML = 'Render Complete';
                  document.getElementById('render-result').innerHTML = '<div class=\\"alert alert-success text-sm mb-4\\">Rendered: ' + data.output_path.split('/').pop() + '</div>';
                }
                setTimeout(function() { btn.disabled = false; }, 3000);
              })
              .catch(function(err) {
                btn.innerHTML = 'Render';
                btn.disabled = false;
                document.getElementById('render-result').innerHTML = '<div class=\\"alert alert-error text-sm mb-4\\">Request failed</div>';
              });
          `}
        >
          Render
        </button>
      </div>
      <div id="render-result" />
      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        <aside
          id="suggestions-panel"
          class="w-72 overflow-y-auto p-2 space-y-2 shrink-0 scrollbar-thin"
          hx-get={`/create/hypercut/suggestions?job_id=${props.jobId}`}
          hx-trigger="load, every 5s"
          hx-swap="innerHTML"
        >
          <span class="loading loading-spinner loading-sm" />
        </aside>
        <iframe
          data-job-id={props.jobId}
          class="flex-1 border-0 rounded-box bg-base-200"
          id="hyperframes-studio-iframe"
        />
        <aside
          data-job-id={props.jobId}
          class="w-80 overflow-y-auto shrink-0 flex flex-col bg-base-200 rounded-box scrollbar-thin"
        >
          <AgentChat jobId={props.jobId} />
        </aside>
      </div>
      <script defer src="/static/js/hypercut-bridge.js" />
      <script defer src="/static/js/agent-chat.js" />
    </div>
  );
}

export function HypercutSuggestions(props: {
  jobId: string;
  suggestions: HypercutSuggestionSchema[];
}) {
  return (
    <div class="space-y-2">
      <h2 class="text-lg font-bold">Suggestions</h2>
      {props.suggestions.length === 0 && (
        <p class="text-sm opacity-70">No suggestions yet.</p>
      )}
      {props.suggestions.map((s) => {
        const displayFilename = s.asset_filename ?? s.meta_filename;
        const displaySubfolder = s.asset_subfolder ?? s.meta_subfolder ?? "";
        const isVideo = displayFilename
          ? /\.(mp4|webm|mov|avi|mkv)$/i.test(displayFilename)
          : false;

        return (
          <div
            key={s.id}
            class="relative bg-base-200 rounded-box overflow-hidden"
          >
            {s.source_type !== "autocut_cut" && displayFilename ? (
              <>
                {isVideo ? (
                  <video
                    src={getAssetPath(displaySubfolder, displayFilename!)}
                    class="w-full h-auto object-contain"
                    muted
                  />
                ) : (
                  <img
                    src={getAssetPath(displaySubfolder, displayFilename!)}
                    class="w-full h-auto object-contain"
                  />
                )}
                <div class="absolute inset-0 flex flex-col justify-between pointer-events-none p-2">
                  <div class="flex justify-between items-start pointer-events-auto">
                    <span
                      class={`badge badge-xs ${
                        isVideo ? "badge-accent" : "badge-primary"
                      }`}
                    >
                      {s.source_type}
                    </span>
                    <div class="flex gap-1">
                      <button
                        class="btn btn-xs btn-ghost"
                        style="cursor:pointer"
                        hx-post={`/api/jobs/hypercut/suggestions/${s.id}/reject`}
                        hx-swap="none"
                      >
                        Skip
                      </button>
                      <button
                        class="btn btn-xs btn-success"
                        style="cursor:pointer"
                        hx-post={`/api/jobs/hypercut/suggestions/${s.id}/accept`}
                        hx-swap="none"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div class="pointer-events-auto">
                    <p class="text-xs opacity-80 bg-base-100/70 px-1.5 py-0.5 rounded inline-block">
                      {s.transcript_anchor_start.toFixed(2)}s -{" "}
                      {s.transcript_anchor_end.toFixed(2)}s
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div class="flex items-center justify-between p-2">
                <div class="flex items-center gap-2">
                  <span class="badge badge-sm badge-primary">{s.source_type}</span>
                  {s.text_content && (
                    <p class="text-sm truncate max-w-[120px]">{s.text_content}</p>
                  )}
                </div>
                <p class="text-xs opacity-60">
                  {s.transcript_anchor_start.toFixed(2)}s -{" "}
                  {s.transcript_anchor_end.toFixed(2)}s
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export async function HypercutJobStatus({ jobId }: { jobId: string }) {
  const { DB } = await import("../db/db");
  const { JobLifecycleStatus } = await import("../events/events");

  const job = await DB.Jobs.findById(jobId).catch(() => null);

  if (!job) {
    return (
      <div class="p-4">
        <div class="alert alert-error">
          <span>Job not found.</span>
          <a href="/create/hypercut" class="btn btn-sm">New Job</a>
        </div>
      </div>
    );
  }

  if (job.status === JobLifecycleStatus.Failed) {
    return (
      <div class="p-4">
        <div class="alert alert-error mb-4">
          <Icons.StatusFailedSmall />
          <span>HyperCut job failed. No composition generated.</span>
          <a href="/create/hypercut" class="btn btn-sm">New Job</a>
        </div>
      </div>
    );
  }

  const isProcessing = job.status === JobLifecycleStatus.Active;

  return (
    <div
      class="p-4"
      hx-ext={isProcessing ? "sse" : undefined}
      sse-connect={isProcessing ? `/jobs/stream?job_id=${jobId}` : undefined}
      hx-get={isProcessing ? `/create/hypercut?show_progress=true&job_id=${jobId}` : undefined}
      hx-trigger={isProcessing ? "sse:job_complete" : undefined}
      hx-swap={isProcessing ? "outerHTML" : undefined}
    >
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body items-center text-center gap-4 py-12">
          {isProcessing ? (
            <>
              <span class="loading loading-spinner loading-lg text-primary" />
              <h2 class="card-title text-xl">Processing HyperCut Job</h2>
              <p class="text-sm opacity-70 max-w-md">
                Transcribing video, detecting filler words, generating content
                suggestions, and building composition...
              </p>
            </>
          ) : (
            <>
              <Icons.StatusComplete />
              <h2 class="card-title text-xl">HyperCut Complete</h2>
              <p class="text-sm opacity-70">Loading workspace...</p>
              <meta
                http-equiv="refresh"
                content={`0;url=/create/hypercut?job_id=${jobId}`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
