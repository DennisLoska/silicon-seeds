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
    <div id="hypercut-workspace" data-job-id={props.jobId} class="p-4 flex flex-col h-[calc(100vh-3.5rem)]">
      <div class="flex items-center justify-between mb-3 gap-2">
        <div class="flex items-center gap-2">
          <h1 class="text-xl font-bold">HyperCut</h1>
          <span class="badge badge-ghost badge-sm font-mono">{props.jobId.slice(0, 8)}</span>
        </div>
        <div class="flex gap-2">
          <button id="regenerate-btn" class="btn btn-ghost btn-sm gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Regenerate
          </button>
          <button id="render-btn" class="btn btn-primary btn-sm gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Render
          </button>
        </div>
      </div>

      <div id="render-result" />

      <div class="flex gap-3 flex-1 min-h-0">
        <aside
          id="suggestions-panel"
          class="w-72 shrink-0 overflow-y-auto space-y-2 scrollbar-thin"
          hx-get={`/create/hypercut/suggestions?job_id=${props.jobId}`}
          hx-trigger="load, every 5s"
          hx-swap="innerHTML"
        >
          <div class="flex items-center justify-center h-20">
            <span class="loading loading-spinner loading-sm" />
          </div>
        </aside>

        <div class="flex-1 flex flex-col min-w-0 relative">
          <div
            id="iframe-loading"
            class="absolute inset-0 flex items-center justify-center bg-base-200 rounded-box z-10"
          >
            <div class="flex flex-col items-center gap-2">
              <span class="loading loading-spinner loading-md text-primary" />
              <p class="text-sm opacity-70">Loading studio...</p>
            </div>
          </div>
          <div class="flex items-center justify-between mb-1 px-1">
            <span class="text-xs opacity-50">Preview</span>
            <button id="fullscreen-btn" class="btn btn-ghost btn-xs" title="Fullscreen">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l4 4m8-4h4m0 0v4m0-4l-4 4M4 16v4m0 0h4m-4 0l4-4m8 4h4m0-4v4m0 0l-4-4"/></svg>
            </button>
          </div>
          <iframe
            data-job-id={props.jobId}
            class="flex-1 border-0 rounded-box bg-base-200 w-full"
            id="hyperframes-studio-iframe"
          />
        </div>

        <aside
          data-job-id={props.jobId}
          class="w-80 shrink-0 flex flex-col bg-base-200 rounded-box overflow-hidden"
        >
          <AgentChat jobId={props.jobId} />
        </aside>
      </div>

      <dialog id="regenerate-modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg">Regenerate composition?</h3>
          <p class="py-4 text-sm opacity-80">
            This rebuilds the timeline from the database, discarding any manual
            edits made in the studio. Suggestions you've already accepted will
            be re-applied.
          </p>
          <div class="modal-action">
            <form method="dialog" class="flex gap-2">
              <button id="regenerate-cancel" class="btn btn-ghost">Cancel</button>
              <button id="regenerate-confirm" class="btn btn-warning">Regenerate</button>
            </form>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop"><button>close</button></form>
      </dialog>

      <script defer src="/static/js/hypercut-bridge.js" />
      <script defer src="/static/js/hypercut-workspace.js" />
      <script defer src="/static/js/agent-chat.js" />
    </div>
  );
}

export function HypercutSuggestions(props: {
  jobId: string;
  suggestions: HypercutSuggestionSchema[];
}) {
  const counts = {
    total: props.suggestions.length,
    cuts: props.suggestions.filter((s) => s.source_type === "autocut_cut").length,
    broll: props.suggestions.filter(
      (s) => s.source_type === "video" || s.source_type === "image",
    ).length,
  };

  return (
    <div class="space-y-2">
      <div class="flex items-center justify-between mb-1">
        <h2 class="text-sm font-bold">Suggestions</h2>
        <div class="flex gap-1">
          <span class="badge badge-ghost badge-xs">{counts.total}</span>
        </div>
      </div>

      <div role="tablist" class="tabs tabs-boxed tabs-xs mb-2" id="suggestion-filters">
        <input type="radio" name="sug-filter" role="tab" class="tab" aria-label="All" checked />
        <input type="radio" name="sug-filter" role="tab" class="tab" aria-label={`Cuts (${counts.cuts})`} data-filter="autocut_cut" />
        <input type="radio" name="sug-filter" role="tab" class="tab" aria-label={`B-roll (${counts.broll})`} data-filter="broll" />
      </div>

      {props.suggestions.length === 0 && (
        <div class="text-center py-8">
          <p class="text-sm opacity-50">No suggestions yet.</p>
          <p class="text-xs opacity-30 mt-1">Processing may still be running.</p>
        </div>
      )}

      {props.suggestions.map((s) => {
        const displayFilename = s.asset_filename ?? s.meta_filename;
        const displaySubfolder = s.asset_subfolder ?? s.meta_subfolder ?? "";
        const isVideo = displayFilename
          ? /\.(mp4|webm|mov|avi|mkv)$/i.test(displayFilename)
          : false;
        const isCut = s.source_type === "autocut_cut";
        const filterTag = isCut ? "autocut_cut" : "broll";

        return (
          <div
            key={s.id}
            class="relative bg-base-200 rounded-box overflow-hidden border border-base-300/50 hover:border-primary/30 transition-colors"
            data-suggestion-type={filterTag}
          >
            {isCut ? (
              <div class="flex items-center justify-between p-2 gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="badge badge-error badge-xs shrink-0">CUT</span>
                  {s.text_content && (
                    <p class="text-xs truncate opacity-70">"{s.text_content}"</p>
                  )}
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <span class="text-[10px] opacity-40 font-mono">
                    {s.transcript_anchor_start.toFixed(1)}s
                  </span>
                </div>
              </div>
            ) : displayFilename ? (
              <>
                <div class="relative">
                  {isVideo ? (
                    <video
                      src={getAssetPath(displaySubfolder, displayFilename!)}
                      class="w-full h-24 object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={getAssetPath(displaySubfolder, displayFilename!)}
                      class="w-full h-24 object-cover"
                    />
                  )}
                  <span class={`badge badge-xs absolute top-1 left-1 ${isVideo ? "badge-accent" : "badge-primary"}`}>
                    {s.source_type}
                  </span>
                </div>
                <div class="flex items-center justify-between p-1.5">
                  <span class="text-[10px] opacity-50 font-mono">
                    {s.transcript_anchor_start.toFixed(1)}s - {s.transcript_anchor_end.toFixed(1)}s
                  </span>
                  <div class="flex gap-1">
                    <button
                      class="btn btn-xs btn-ghost btn-square suggestion-skip"
                      title="Skip"
                      data-suggestion-id={s.id}
                      hx-post={`/api/jobs/hypercut/suggestions/${s.id}/reject`}
                      hx-swap="none"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                    <button
                      class="btn btn-xs btn-success btn-square suggestion-add"
                      title="Add to timeline"
                      data-suggestion-id={s.id}
                      hx-post={`/api/jobs/hypercut/suggestions/${s.id}/accept`}
                      hx-swap="none"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    </button>
                  </div>
                </div>
              </>
            ) : null}
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
