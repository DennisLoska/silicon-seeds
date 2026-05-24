import { JSX } from "hono/jsx";
import { DB } from "../db/db";
import { Event, JobStatus } from "../events/events";
import { Icons } from "./icons";
import { getAssetPath } from "./utils";

export interface EventListProps {
  jobId: string;
  source?: "jobs-events" | "compose-progress" | "image-progress";
}

const EVENT_LABELS = {
  [Event.NewTextPrompt]: "Text Prompt",
  [Event.NewImagePrompt]: "Image Prompt",
  [Event.NewVideoPrompt]: "Video Prompt",
  [Event.NewVideoComposition]: "Final Composition",
  [Event.NewTransitionPrompt]: "Transition Prompt",
  [Event.NewAudioPrompt]: "Audio Prompt",
};

const EVENT_ICONS = {
  [Event.NewTextPrompt]: "🖊️",
  [Event.NewImagePrompt]: "🖼️",
  [Event.NewVideoPrompt]: "🎬",
  [Event.NewVideoComposition]: "🏁",
  [Event.NewTransitionPrompt]: "🔄",
  [Event.NewAudioPrompt]: "🎵",
};

export const EventList = async ({ jobId, source = "jobs-events" }: EventListProps) => {
  const jobEvents = await DB.Events.findByJobIdChronological(jobId);

  if (jobEvents.length === 0) {
    return (
      <div className="p-6 text-center text-base-content/60">
        Events will appear here once the job runs.
      </div>
    );
  }

  const eventItems = jobEvents.map(async (evt, index) => {
    const timestamp = new Date(evt.created_at!).toLocaleString();
    const isComplete = evt.status === JobStatus.Complete;
    const assetMeta = isComplete
      ? await DB.Meta.findByEventId(evt.id).catch(() => null)
      : null;

    const promptText = evt.prompt ? escapeHtml(evt.prompt) : "Instrumental";
    const lineClass = isComplete ? "bg-success" : "";

    const metadataBadges: JSX.HTMLAttributes[] = [];

    switch (evt.type) {
      case Event.NewTextPrompt:
        metadataBadges.push(
          <span key="source" className="badge badge-secondary text-xs">
            text
          </span>,
        );
        break;
      case Event.NewImagePrompt:
        if (evt.lora) {
          metadataBadges.push(
            <span key="lora" className="badge badge-info text-xs">
              LoRA: {evt.lora}
            </span>,
          );
        }
        if (assetMeta) {
          metadataBadges.push(
            <span key="asset" className="badge badge-primary text-xs">
              {assetMeta.type}
            </span>,
          );
          metadataBadges.push(
            <span key="filename" className="badge badge-secondary text-xs">
              {assetMeta.filename}
            </span>,
          );
        }
        break;
      case Event.NewVideoPrompt:
      case Event.NewVideoComposition:
        metadataBadges.push(
          <span key="source" className="badge badge-secondary text-xs">
            Source: {assetMeta?.filename}
          </span>,
        );
        break;
      case Event.NewTransitionPrompt:
        metadataBadges.push(
          <span key="start" className="badge badge-secondary text-xs">
            Start: {evt.startImg}
          </span>,
        );
        metadataBadges.push(
          <span key="end" className="badge badge-secondary text-xs">
            End: {evt.endImg}
          </span>,
        );
        break;
      case Event.NewAudioPrompt:
        if (evt.duration) {
          metadataBadges.push(
            <span key="duration" className="badge badge-accent text-xs">
              Duration: {evt.duration}s
            </span>,
          );
        }
        break;
    }

    const renderAssetSection = () => {
      if (!assetMeta && evt.type !== Event.NewTextPrompt) return null;
      const assetPath = assetMeta
        ? getAssetPath(assetMeta.subfolder, assetMeta.filename)
        : null;
      const canRegenerate =
        evt.type === Event.NewImagePrompt ||
        evt.type === Event.NewVideoPrompt ||
        evt.type === Event.NewTransitionPrompt;
      const targetSelector =
        source === "compose-progress"
          ? "#compose-progress-fragment"
          : source === "image-progress"
            ? "#distinct-image-progress-fragment"
            : "#job-content-area";
      const sourceQuery =
        source === "compose-progress"
          ? "compose-progress"
          : source === "image-progress"
            ? "image-progress"
            : "jobs-events";
      const tabQuery = source === "jobs-events" ? "&tab=events" : "";
      const downloadBtn = (
        <div className="flex justify-end gap-2">
          {canRegenerate && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              hx-post={`/api/jobs/${evt.jobId}/events/${evt.id}/regenerate?source=${sourceQuery}${tabQuery}`}
              hx-target={targetSelector}
              hx-swap="outerHTML"
            >
              <Icons.RegenerateIconSmall />
              Regenerate
            </button>
          )}
          {assetPath && (
            <a href={assetPath} download className="btn btn-sm btn-primary">
              <Icons.DownloadIconSmall />
              Download
            </a>
          )}
        </div>
      );

      switch (evt.type) {
        case Event.NewTextPrompt:
          return (
            <div>
              <p className="text-sm font-medium mb-1 text-base-content/60">
                Text:
              </p>
              <div className="prompt-text overflow-y-scroll p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words">
                {evt.text}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onclick={`navigator.clipboard.writeText("${escapeForJsString(
                    evt.text || "",
                  )}")`}
                  className="btn btn-sm btn-secondary mt-2"
                >
                  <Icons.CopyIcon />
                  <span className="ml-1">Copy</span>
                </button>
              </div>
            </div>
          );
        case Event.NewImagePrompt:
          return (
            <div>
              <p className="text-sm font-medium mb-1 text-base-content/60">
                Generated Image:
              </p>
              <img
                src={assetPath!}
                alt="Generated image"
                className="w-full h-auto rounded-lg border border-base-300 mb-2"
              />
              {downloadBtn}
            </div>
          );
        case Event.NewAudioPrompt:
          return (
            <div>
              <p className="text-sm font-medium mb-1 text-base-content/60">
                Audio:
              </p>
              <audio controls className="w-full mb-2">
                <source
                  src={assetPath!}
                  type="audio/mpeg"
                />
                Your browser does not support the audio element.
              </audio>
              {downloadBtn}
            </div>
          );
        case Event.NewVideoComposition:
        case Event.NewVideoPrompt:
          return (
            <div>
              <p className="text-sm font-medium mb-1 text-base-content/60">
                Video:
              </p>
              <video
                controls
                className="w-full rounded-lg border border-base-300 mb-2"
              >
                <source
                  src={assetPath!}
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
              {downloadBtn}
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <li key={evt.id}>
        {index > 0 && <hr className={lineClass} />}
        <div className="timeline-end timeline-box scrollbar-hide w-[98%] resize both overflow-auto border border-base-300 min-w-72 max-w-full">
          <details className="w-full bg-base-100 open:bg-base-100">
            <summary className="cursor-pointer list-none p-4 hover:bg-base-200 rounded-lg transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-base-content/60">
                    {EVENT_LABELS[evt.type]}
                  </span>
                  <span className="text-xs text-base-content/40 whitespace-nowrap">
                    {timestamp}
                  </span>
                </div>
                <span
                  className={
                    isComplete
                      ? "badge badge-success text-xs"
                      : "badge badge-warning text-xs"
                  }
                >
                  {isComplete ? (
                    <Icons.StatusCompleteSmall />
                  ) : (
                    <Icons.StatusPendingSmall />
                  )}
                </span>
              </div>
            </summary>
            <div className="p-4 pt-0 mt-4 space-y-3 rounded-b-lg">
              {metadataBadges.length > 0 && (
                <div className="flex flex-wrap gap-2">{metadataBadges}</div>
              )}
              {renderAssetSection()}
              <div>
                <p className="text-sm font-medium mb-1 text-base-content/60">
                  Prompt:
                </p>
                <div className="prompt-text overflow-y-scroll p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words">
                  {promptText}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onclick={`navigator.clipboard.writeText("${escapeForJsString(
                      evt.prompt || "",
                    )}")`}
                    className="btn btn-sm btn-secondary mt-2"
                  >
                    <Icons.CopyIcon />
                    <span className="ml-1">Copy</span>
                  </button>
                </div>
              </div>
            </div>
          </details>
        </div>
        <div className="timeline-middle">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-sm transition-all ${
              isComplete
                ? "bg-gradient-to-br from-success to-success/70"
                : "bg-base-200"
            }`}
          >
            {EVENT_ICONS[evt.type]}
          </div>
        </div>
        {index < jobEvents.length - 1 && <hr className={lineClass} />}
      </li>
    );
  });

  return (
    <ul className="timeline timeline-compact timeline-vertical">
      {await Promise.all(eventItems)}
    </ul>
  );
};

function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

function escapeForJsString(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}
