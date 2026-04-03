import { DB } from "../db/db";
import { Event, JobStatus } from "../events/events";

export async function eventsListFragment(jobId: string) {
  let jobEvents = await DB.Events.findByJobId(jobId);

  // Sort by created_at in the fragment (ascending - oldest first)
  jobEvents.sort(
    (a, b) =>
      new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime(),
  );

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
    const metadataBadges: any[] = [];

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

    // Prompt content with truncation
    const promptText = evt.prompt ? escapeHtml(evt.prompt) : "Instrumental";

    return (
      <div key={evt.id} class="flex gap-4 items-start">
        {/* Vertical line and icon column */}
        <div class="flex flex-col items-center">
          {/* Icon - colored based on status */}
          <div 
            class={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm transition-all ${
              isComplete 
                ? 'bg-gradient-to-br from-success to-success/70 border-2 border-success/30' 
                : 'bg-base-200 border-2 border-base-300'
            }`}
          >
            {typeIcon}
          </div>
          
          {/* Vertical line - only if not the last item */}
          {index < jobEvents.length - 1 && (
            <div class="w-0.5 flex-1 min-h-8">
              {/* Colored segment for completed events */}
              <div 
                class={`w-full transition-all duration-300 ${
                  isComplete ? 'bg-success' : 'bg-base-300'
                }`}
              ></div>
            </div>
          )}
        </div>

        {/* Card on the right side */}
        <div class="flex-1 min-w-0">
          <details class="card bg-base-100 shadow-sm w-full">
            <summary class="cursor-pointer p-4 card-title">
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-2 flex-wrap">
                  {statusBadge}
                  <span class="text-sm text-base-content/60">{typeLabel}</span>
                </div>
                <span class="text-xs text-base-content/40 whitespace-nowrap">{timestamp}</span>
              </div>
            </summary>

            {/* Expanded content */}
            <div class="p-4 pt-0 space-y-3">
              {/* Metadata badges */}
              {metadataBadges.length > 0 && (
                <div class="flex flex-wrap gap-2">{metadataBadges}</div>
              )}

              {/* Prompt text with truncation */}
              <div>
                <p class="text-sm font-medium mb-1 text-base-content/60">
                  Prompt:
                </p>
                <div class="prompt-text p-3 bg-base-200 rounded-lg text-sm line-clamp-4 break-words">
                  {promptText}
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>
    );
  });

  return (
    <div class="space-y-2">
      {eventItems}
    </div>
  );
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
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
