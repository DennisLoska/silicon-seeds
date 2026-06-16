import { Icons } from "./icons";
import type { HypercutSuggestionSchema } from "../db/db";
import { AgentChat } from "./agent-chat";

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
          class="w-72 overflow-y-auto border-r p-2 space-y-2 shrink-0"
          hx-get={`/create/hypercut/suggestions?job_id=${props.jobId}`}
          hx-trigger="load, every 5s"
          hx-swap="innerHTML"
        >
          <span class="loading loading-spinner loading-sm" />
        </aside>
        <iframe
          src={`/studio?job_id=${props.jobId}`}
          class="flex-1 border-0 rounded-box bg-base-200"
          id="hyperframes-studio-iframe"
        />
        <aside
          id="agent-chat-panel"
          data-job-id={props.jobId}
          class="w-80 overflow-y-auto border-l shrink-0 flex flex-col bg-base-200 rounded-box"
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
      {props.suggestions.map((s) => (
        <div
          key={s.id}
          class={`card card-compact ${
            s.source_type === "autocut_cut"
              ? "bg-error/10 border border-error/30"
              : "bg-base-100 shadow-sm"
          }`}
        >
          <div class="card-body p-3">
            <div class="flex justify-between items-start gap-2">
              <div class="min-w-0">
                <span
                  class={`badge badge-sm ${
                    s.source_type === "autocut_cut"
                      ? "badge-error"
                      : "badge-primary"
                  }`}
                >
                  {s.source_type}
                </span>
                <p class="text-sm mt-1 truncate">
                  {s.text_content ?? s.asset_id ?? "content"}
                </p>
                <p class="text-xs opacity-60">
                  {s.transcript_anchor_start.toFixed(2)}s -{" "}
                  {s.transcript_anchor_end.toFixed(2)}s
                </p>
              </div>
              <div class="card-actions flex-nowrap">
                <button
                  class="btn btn-xs btn-success add-to-timeline"
                  data-suggestion-id={s.id}
                  data-job-id={props.jobId}
                >
                  Add
                </button>
                <button
                  class="btn btn-xs btn-ghost"
                  hx-post={`/api/jobs/hypercut/suggestions/${s.id}/reject`}
                  hx-swap="none"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export const HypercutIcon = Icons.Video;
