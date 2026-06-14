import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

interface TimelineClip {
  id: string;
  start: number;
  end: number;
  track: number;
  label: string;
  kind: "autocut_cut" | "content";
}

interface Suggestion {
  id: string;
  source_type: "image" | "video" | "text" | "autocut_cut";
  text_content: string | null;
  asset_id: string | null;
  transcript_anchor_start: number;
  transcript_anchor_end: number;
}

interface Props {
  jobId: string;
  sourceVideoUrl: string;
  initialClips: TimelineClip[];
}

const TIMELINE_SCALE = 50; // pixels per second

function HyperframesIsland({ jobId, sourceVideoUrl, initialClips }: Props) {
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    fetch(`/api/jobs/hypercut/${jobId}/suggestions`)
      .then((res) => res.json())
      .then((data: { suggestions: Suggestion[] }) => {
        setSuggestions(data.suggestions);
      })
      .catch((err) => console.error("Failed to load suggestions", err));
  }, [jobId]);

  const timelineWidth = useMemo(
    () => Math.max(duration * TIMELINE_SCALE, 800),
    [duration],
  );

  async function addToTimeline(suggestion: Suggestion) {
    const clip: TimelineClip = {
      id: crypto.randomUUID(),
      start: suggestion.transcript_anchor_start,
      end: suggestion.transcript_anchor_end,
      track: suggestion.source_type === "autocut_cut" ? 0 : 1,
      label:
        suggestion.text_content ??
        suggestion.asset_id ??
        suggestion.source_type,
      kind: suggestion.source_type === "autocut_cut" ? "autocut_cut" : "content",
    };

    try {
      await fetch("/api/jobs/hypercut/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          suggestion_id: suggestion.id,
          start_time: clip.start,
          end_time: clip.end,
          track: clip.track,
          layer_data: { type: suggestion.source_type, label: clip.label },
        }),
      });
      setClips((prev) => [...prev, clip]);
    } catch (err) {
      console.error("Failed to add clip", err);
    }
  }

  async function renderTimeline() {
    try {
      const res = await fetch(`/api/jobs/hypercut/${jobId}/render`, {
        method: "POST",
      });
      const data = await res.json();
      alert(data.output_path ? `Rendered: ${data.output_path}` : `Error: ${data.error}`);
    } catch (err) {
      console.error("Render failed", err);
      alert("Render failed");
    }
  }

  return (
    <div className="hyperframes-island space-y-4">
      <video
        ref={videoRef}
        src={sourceVideoUrl}
        controls
        className="w-full rounded"
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
      />

      <div className="flex gap-4">
        <div className="flex-1 overflow-x-auto border rounded p-2 bg-base-200">
          <div
            className="relative h-32"
            style={{ width: timelineWidth }}
          >
            {clips.map((clip) => (
              <div
                key={clip.id}
                className={`absolute h-8 rounded px-2 text-xs flex items-center overflow-hidden ${
                  clip.kind === "autocut_cut"
                    ? "bg-error/30 border border-error"
                    : "bg-primary/30 border border-primary"
                }`}
                style={{
                  left: clip.start * TIMELINE_SCALE,
                  width: Math.max((clip.end - clip.start) * TIMELINE_SCALE, 20),
                  top: clip.track * 40 + 10,
                }}
                title={clip.label}
              >
                {clip.label.slice(0, 20)}
              </div>
            ))}
            <div
              className="absolute top-0 bottom-0 w-px bg-accent"
              style={{ left: currentTime * TIMELINE_SCALE }}
            />
          </div>
        </div>

        <div className="w-64 space-y-2">
          <h3 className="font-bold">Suggestions</h3>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className={`card card-compact p-2 cursor-pointer hover:bg-base-300 ${
                  s.source_type === "autocut_cut" ? "bg-error/10" : "bg-base-100"
                }`}
                onClick={() => addToTimeline(s)}
              >
                <span className="badge badge-sm">{s.source_type}</span>
                <p className="text-xs truncate">
                  {s.text_content ?? s.asset_id ?? "content"}
                </p>
                <p className="text-xs opacity-60">
                  {s.transcript_anchor_start.toFixed(1)}s -{" "}
                  {s.transcript_anchor_end.toFixed(1)}s
                </p>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-sm w-full" onClick={renderTimeline}>
            Render
          </button>
        </div>
      </div>
    </div>
  );
}

const mount = document.getElementById("hyperframes-island");
if (mount) {
  const props = JSON.parse(mount.dataset.props ?? "{}");
  const root = createRoot(mount);
  root.render(<HyperframesIsland {...props} />);
}
