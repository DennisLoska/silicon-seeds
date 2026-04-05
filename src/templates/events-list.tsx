import { JSX } from "hono/jsx";
import { DB } from "../db/db";
import { Event, JobStatus } from "../events/events";

const STATUS_ICONS = {
  complete: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  pending: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const EVENT_LABELS = {
  [Event.NewImagePrompt]: "Image Prompt",
  [Event.NewVideoPrompt]: "Video Prompt",
  [Event.NewTransitionPrompt]: "Transition Prompt",
  [Event.NewAudioPrompt]: "Audio Prompt",
};

const EVENT_ICONS = {
  [Event.NewImagePrompt]: "🖼️",
  [Event.NewVideoPrompt]: "🎬",
  [Event.NewTransitionPrompt]: "🔄",
  [Event.NewAudioPrompt]: "🎵",
};

const DOWNLOAD_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const COPY_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 20.25h4.5v-4.5h-4.5zm-4.5 0h4.5v-4.5H8.25zM3.75 7.5H12v4.5H3.75zm4.5 4.5h4.5v4.5H8.25z" />
  </svg>
);

export async function eventsListFragment(jobId: string) {
  const jobEvents = await DB.Events.findByJobId(jobId);

  if (jobEvents.length === 0) {
    return (
      <div className="p-6 text-center text-base-content/60">
        No events yet for this job.
      </div>
    );
  }

  const eventItems = jobEvents.map(async (evt, index) => {
    const timestamp = new Date(evt.created_at!).toLocaleString();
    const isComplete = evt.status === JobStatus.Complete;
    const assetMeta = isComplete ? await DB.Meta.findByEventId(evt.id).catch(() => null) : null;
    const promptText = evt.prompt ? escapeHtml(evt.prompt) : "Instrumental";
    const lineClass = isComplete ? "bg-success" : "";

    const metadataBadges: JSX.HTMLAttributes[] = [];

    switch (evt.type) {
      case Event.NewImagePrompt:
        if (evt.lora) {
          metadataBadges.push(<span key="lora" className="badge badge-info text-xs">LoRA: {evt.lora}</span>);
        }
        if (assetMeta) {
          metadataBadges.push(<span key="asset" className="badge badge-primary text-xs">{assetMeta.type}</span>);
          metadataBadges.push(<span key="filename" className="badge badge-secondary text-xs">{assetMeta.filename}</span>);
        }
        break;
      case Event.NewVideoPrompt:
        metadataBadges.push(<span key="source" className="badge badge-secondary text-xs">Source: {evt.filename}</span>);
        break;
      case Event.NewTransitionPrompt:
        metadataBadges.push(<span key="start" className="badge badge-secondary text-xs">Start: {evt.startImg}</span>);
        metadataBadges.push(<span key="end" className="badge badge-secondary text-xs">End: {evt.endImg}</span>);
        break;
      case Event.NewAudioPrompt:
        if (evt.duration) {
          metadataBadges.push(<span key="duration" className="badge badge-accent text-xs">Duration: {evt.duration}s</span>);
        }
        break;
    }

    const renderAssetSection = () => {
      if (!assetMeta) return null;
      const downloadBtn = (
        <div className="flex justify-end">
          <a href={`/assets/${assetMeta.filename}`} download className="btn btn-sm btn-primary">
            {DOWNLOAD_ICON}
            Download
          </a>
        </div>
      );

      switch (evt.type) {
        case Event.NewImagePrompt:
          return (
            <div>
              <p className="text-sm font-medium mb-1 text-base-content/60">Generated Image:</p>
              <img src={`/assets/${assetMeta.filename}`} alt="Generated image" className="w-full h-auto rounded-lg border border-base-300 mb-2" />
              {downloadBtn}
            </div>
          );
        case Event.NewAudioPrompt:
          return (
            <div>
              <p className="text-sm font-medium mb-1 text-base-content/60">Audio:</p>
              <audio controls className="w-full mb-2">
                <source src={`/assets/${assetMeta.filename}`} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
              {downloadBtn}
            </div>
          );
        case Event.NewVideoPrompt:
          return (
            <div>
              <p className="text-sm font-medium mb-1 text-base-content/60">Video:</p>
              <video controls className="w-full rounded-lg border border-base-300 mb-2">
                <source src={`/assets/${assetMeta.filename}`} type="video/mp4" />
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
        <div className="timeline-end timeline-box xl:w-1/3 resize both overflow-auto border border-base-300 min-w-72 max-w-full">
          <details className="w-full bg-base-100 open:bg-base-100">
            <summary className="cursor-pointer list-none p-4 hover:bg-base-200 rounded-lg transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-base-content/60">{EVENT_LABELS[evt.type]}</span>
                  <span className="text-xs text-base-content/40 whitespace-nowrap">{timestamp}</span>
                </div>
                <span className={isComplete ? "badge badge-success text-xs" : "badge badge-warning text-xs"}>
                  {STATUS_ICONS[isComplete ? "complete" : "pending"]}
                </span>
              </div>
            </summary>
            <div className="p-4 pt-0 mt-4 space-y-3 rounded-b-lg">
              {metadataBadges.length > 0 && <div className="flex flex-wrap gap-2">{metadataBadges}</div>}
              {renderAssetSection()}
              <div>
                <p className="text-sm font-medium mb-1 text-base-content/60">Prompt:</p>
                <div className="prompt-text overflow-y-scroll p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words">
                  {promptText}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onclick={`navigator.clipboard.writeText("${escapeForJsString(evt.prompt || "")}")`}
                    className="btn btn-sm btn-secondary mt-2"
                  >
                    {COPY_ICON}
                    <span className="ml-1">Copy</span>
                  </button>
                </div>
              </div>
            </div>
          </details>
        </div>
        <div className="timeline-middle">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-sm transition-all ${isComplete ? "bg-gradient-to-br from-success to-success/70" : "bg-base-200"}`}>
            {EVENT_ICONS[evt.type]}
          </div>
        </div>
        {index < jobEvents.length - 1 && <hr className={lineClass} />}
      </li>
    );
  });

  return <ul className="timeline timeline-compact timeline-vertical">{await Promise.all(eventItems)}</ul>;
}

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
    .replace(/"/g, "\\\"")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}
