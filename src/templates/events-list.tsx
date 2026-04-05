import { JSX } from "hono/jsx";
import { DB } from "../db/db";
import { Event, JobStatus } from "../events/events";

export async function eventsListFragment(jobId: string) {
  const jobEvents = await DB.Events.findByJobId(jobId);

  if (jobEvents.length === 0) {
    return (
      <div className="p-6 text-center text-base-content/60">
        No events yet for this job.
      </div>
    );
  }

  const eventItems = jobEvents.map((evt, index) => {
    // Format timestamp
    const timestamp = new Date(evt.created_at!).toLocaleString();

    // Get event name
    const eventName = {
      [Event.NewImagePrompt]: "Image Prompt",
      [Event.NewVideoPrompt]: "Video Prompt",
      [Event.NewTransitionPrompt]: "Transition Prompt",
      [Event.NewAudioPrompt]: "Audio Prompt",
    }[evt.type];

    // Get type icon
    const typeIcon = {
      [Event.NewImagePrompt]: "🖼️",
      [Event.NewVideoPrompt]: "🎬",
      [Event.NewTransitionPrompt]: "🔄",
      [Event.NewAudioPrompt]: "🎵",
    }[evt.type];

    // Determine if event is complete
    const isComplete = evt.status === JobStatus.Complete;

    // Status badge with icon
    const statusBadge = isComplete ? (
      <span className="badge badge-success text-xs">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
    ) : (
      <span className="badge badge-warning text-xs">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
    );

    // Build metadata badges
    const metadataBadges: JSX.HTMLAttributes[] = [];

    switch (evt.type) {
      case Event.NewImagePrompt:
        if (evt.lora) {
          metadataBadges.push(
            <span key="lora" className="badge badge-info text-xs">
              LoRA: {evt.lora}
            </span>,
          );
        }
        break;

      case Event.NewVideoPrompt:
        metadataBadges.push(
          <span key="source" className="badge badge-secondary text-xs">
            Source: {evt.filename}
          </span>,
        );
        break;

      case Event.NewTransitionPrompt:
        metadataBadges.push(
          <span key="start" className="badge badge-secondary text-xs">
            Start: {evt.startImg}
          </span>,
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

    const promptText = evt.prompt ? escapeHtml(evt.prompt) : "Instrumental";

    // Determine line color based on status
    const lineClass = isComplete ? "bg-success" : "";

    return (
      <li key={evt.id}>
        {/* HR before (not on first item) */}
        {index > 0 && <hr className={lineClass} />}

        {/* Content box - always on the right (timeline-end) */}
        <div className="timeline-end timeline-box xl:w-1/3">
          <details className="w-full bg-base-100 open:bg-base-100">
            <summary className="cursor-pointer list-none p-4 hover:bg-base-200 rounded-lg transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-base-content/60">{eventName}</span>
                  <span className="text-xs text-base-content/40 whitespace-nowrap">
                    {timestamp}
                  </span>
                </div>
                {statusBadge}
              </div>
            </summary>

            {/* Expanded content */}
            <div className="p-4 pt-0 mt-4 space-y-3 rounded-b-lg">
              {metadataBadges.length > 0 && (
                <div className="flex flex-wrap gap-2">{metadataBadges}</div>
              )}
              <div>
                <p className="text-sm font-medium mb-1 text-base-content/60">
                  Prompt:
                </p>
                <div className="prompt-text overflow-y-scroll p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words">
                  {promptText}
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Icon in the middle */}
        <div className="timeline-middle">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-sm transition-all ${
              isComplete
                ? "bg-gradient-to-br from-success to-success/70"
                : "bg-base-200"
            }`}
          >
            {typeIcon}
          </div>
        </div>

        {/* HR after (not on last item) */}
        {index < jobEvents.length - 1 && <hr className={lineClass} />}
      </li>
    );
  });

  return (
    <ul className="timeline timeline-compact timeline-vertical">{eventItems}</ul>
  );
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
