import { JSX } from "hono/jsx";
import { DB } from "../db/db";
import { Event, JobStatus } from "../events/events";

export async function eventsListFragment(jobId: string) {
  const jobEvents = await DB.Events.findByJobId(jobId);

  if (jobEvents.length === 0) {
    return (
      <div class="p-6 text-center text-base-content/60">
        No events yet for this job.
      </div>
    );
  }

  const eventItems = jobEvents.map((evt, index) => {
    // Format timestamp
    const timestamp = new Date(evt.created_at!).toLocaleString();

    // Get type label
    const typeLabel = {
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

    // Status badge
    const statusBadge = isComplete ? (
      <span class="badge badge-success text-xs">Complete</span>
    ) : (
      <span class="badge badge-warning text-xs">Pending</span>
    );

    // Build metadata badges
    const metadataBadges: JSX.HTMLAttributes[] = [];

    switch (evt.type) {
      case Event.NewImagePrompt:
        if (evt.lora) {
          metadataBadges.push(
            <span key="lora" class="badge badge-info text-xs">
              LoRA: {evt.lora}
            </span>,
          );
        }
        break;

      case Event.NewVideoPrompt:
        metadataBadges.push(
          <span key="source" class="badge badge-secondary text-xs">
            Source: {evt.filename}
          </span>,
        );
        break;

      case Event.NewTransitionPrompt:
        metadataBadges.push(
          <span key="start" class="badge badge-secondary text-xs">
            Start: {evt.startImg}
          </span>,
          <span key="end" class="badge badge-secondary text-xs">
            End: {evt.endImg}
          </span>,
        );
        break;

      case Event.NewAudioPrompt:
        if (evt.duration) {
          metadataBadges.push(
            <span key="duration" class="badge badge-accent text-xs">
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
        {index > 0 && <hr class={lineClass} />}

        {/* Content box - always on the right (timeline-end) */}
        <div class="timeline-end timeline-box xl:w-1/3">
          <details class="w-full bg-base-100 open:bg-base-100">
            <summary class="cursor-pointer list-none p-4 card-title hover:bg-base-200 rounded-lg transition-colors">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-2 flex-wrap">
                  {statusBadge}
                  <span class="text-sm text-base-content/60">{typeLabel}</span>
                </div>
                <span class="text-xs text-base-content/40 whitespace-nowrap">
                  {timestamp}
                </span>
              </div>
            </summary>

            {/* Expanded content */}
            <div class="p-4 pt-0 mt-4 space-y-3 rounded-b-lg">
              {metadataBadges.length > 0 && (
                <div class="flex flex-wrap gap-2">{metadataBadges}</div>
              )}
              <div>
                <p class="text-sm font-medium mb-1 text-base-content/60">
                  Prompt:
                </p>
                <div class="prompt-text overflow-y-scroll p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words">
                  {promptText}
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Icon in the middle */}
        <div class="timeline-middle">
          <div
            class={`w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-sm transition-all ${
              isComplete
                ? "bg-gradient-to-br from-success to-success/70"
                : "bg-base-200"
            }`}
          >
            {typeIcon}
          </div>
        </div>

        {/* HR after (not on last item) */}
        {index < jobEvents.length - 1 && <hr class={lineClass} />}
      </li>
    );
  });

  return (
    <ul class="timeline timeline-compact timeline-vertical">{eventItems}</ul>
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
