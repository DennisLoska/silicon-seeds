import { Icons } from "./icons";
import type { HypercutSuggestionSchema } from "../db/db";

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
      <h1 className="text-2xl font-bold mb-4">HyperCut Workspace</h1>
      <div
        id="hyperframes-island"
        data-props={JSON.stringify(props)}
        className="min-h-[500px]"
      />
      <script
        dangerouslySetInnerHTML={{
          __html: [
            "(function(){",
            "  var el = document.getElementById('hyperframes-island');",
            "  if (!el) return;",
            "  function tryMount() {",
            "    if (window.mountHyperframesIsland) {",
            "      window.mountHyperframesIsland(el);",
            "    } else {",
            "      setTimeout(tryMount, 100);",
            "    }",
            "  }",
            "  tryMount();",
            "})();",
          ].join("\n"),
        }}
      />
    </div>
  );
}

export function HypercutSuggestions(props: {
  jobId: string;
  suggestions: HypercutSuggestionSchema[];
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-bold">Suggestions</h2>
      {props.suggestions.length === 0 && (
        <p className="text-sm opacity-70">No suggestions yet.</p>
      )}
      {props.suggestions.map((s) => (
        <div
          key={s.id}
          className={`card card-compact ${
            s.source_type === "autocut_cut"
              ? "bg-error/10 border border-error/30"
              : "bg-base-100 shadow-sm"
          }`}
        >
          <div className="card-body p-3">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <span
                  className={`badge badge-sm ${
                    s.source_type === "autocut_cut"
                      ? "badge-error"
                      : "badge-primary"
                  }`}
                >
                  {s.source_type}
                </span>
                <p className="text-sm mt-1 truncate">
                  {s.text_content ?? s.asset_id ?? "content"}
                </p>
                <p className="text-xs opacity-60">
                  {s.transcript_anchor_start.toFixed(2)}s -{" "}
                  {s.transcript_anchor_end.toFixed(2)}s
                </p>
              </div>
              <div className="card-actions flex-nowrap">
                <button
                  className="btn btn-xs btn-success"
                  hx-post={`/api/jobs/hypercut/suggestions/${s.id}/accept`}
                  hx-swap="none"
                >
                  Add
                </button>
                <button
                  className="btn btn-xs btn-ghost"
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
