import { JSX } from "hono/jsx";
import { DB } from "../db/db";
import { Event, JobStatus } from "../events/events";
import { Icons } from "./icons";
import { getAssetPath } from "./utils";

export interface EventListProps {
  jobId: string;
  source?: "jobs-events" | "compose-progress" | "image-progress" | "audio-progress";
  offset?: number;
  limit?: number;
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

const PAGE_SIZE = 20;

function renderSentinel(jobId: string, offset: number, source: string) {
  const limit = PAGE_SIZE;
  return (
    <div
      id="events-sentinel"
      className="py-6 text-center"
      hx-get={`/jobs/events?job_id=${jobId}&offset=${offset}&limit=${limit}&source=${source}`}
      hx-trigger="intersect once threshold:0.1 root:#jobs-main-scroll"
      hx-swap="outerHTML"
    >
      <span className="loading loading-spinner loading-sm"></span>
    </div>
  );
}

export const EventList = async ({
  jobId,
  source = "jobs-events",
  offset = 0,
  limit = PAGE_SIZE,
}: EventListProps & { offset?: number; limit?: number }) => {
  // Fetch one extra to detect hasMore without extra count query
  const fetchLimit = limit + 1;
  const jobEvents = await DB.Events.findByJobIdChronological(jobId, {
    limit: fetchLimit,
    offset,
  });

  const hasMore = jobEvents.length > limit;
  const pageEvents = hasMore ? jobEvents.slice(0, limit) : jobEvents;

  if (pageEvents.length === 0 && offset === 0) {
    return (
      <div className="p-6 text-center text-base-content/60">
        Events will appear here once the job runs.
      </div>
    );
  }

  if (pageEvents.length === 0) {
    return (
      <div id="events-sentinel" className="py-6 text-center text-base-content/40 text-sm">
        No more events
      </div>
    );
  }

  // Batch fetch meta for all complete events in this page — avoids N+1 queries
  const completeIds = pageEvents.filter((e) => e.status === JobStatus.Complete).map((e) => e.id);
  const metas = await DB.Meta.findManyByEventIds(completeIds);
  const metaById = new Map(metas.map((m) => [m.event_id, m]));

  const eventItems = pageEvents.map(async (evt, index) => {
    const timestamp = new Date(evt.created_at!).toLocaleString();
    const isComplete = evt.status === JobStatus.Complete;
    const assetMeta = isComplete ? (metaById.get(evt.id) ?? null) : null;

    const promptText = evt.prompt || "Instrumental";
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
        if (evt.lyrics) {
          metadataBadges.push(
            <span key="lyrics" className="badge badge-secondary text-xs">
              lyrics
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
            : source === "audio-progress"
              ? "#distinct-audio-progress-fragment"
            : "#job-content-area";
      const sourceQuery =
        source === "compose-progress"
          ? "compose-progress"
          : source === "image-progress"
            ? "image-progress"
            : source === "audio-progress"
              ? "audio-progress"
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
              <div className="prompt-text overflow-y-scroll p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words whitespace-pre-wrap">
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
                loading="lazy"
                decoding="async"
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
                preload="metadata"
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

    const isFirstOverall = offset === 0 && index === 0;
    const isLastPageItem = index === pageEvents.length - 1;
    const showBottomHr = hasMore || !isLastPageItem;

    return (
      <li key={evt.id} style="content-visibility:auto; contain-intrinsic-size: 200px 300px;">
        {!isFirstOverall && <hr className={lineClass} />}
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
              {evt.type === Event.NewAudioPrompt ? (
                <>
                  {(() => {
                    const lyricPromptText = evt.lyrics || "";

                    return (
                      <>
                  <div>
                    <p className="text-sm font-medium mb-1 text-base-content/60">
                      Instrumental Prompt:
                    </p>
                    <div className="prompt-text overflow-y-scroll p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words whitespace-pre-wrap">
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

                  {evt.lyrics ? (
                    <div>
                      <p className="text-sm font-medium mb-1 text-base-content/60">
                        Lyric Prompt:
                      </p>
                      <div className="prompt-text overflow-y-scroll p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words whitespace-pre-wrap">
                        {lyricPromptText}
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onclick={`navigator.clipboard.writeText("${escapeForJsString(
                            evt.lyrics,
                          )}")`}
                          className="btn btn-sm btn-secondary mt-2"
                        >
                          <Icons.CopyIcon />
                          <span className="ml-1">Copy</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                      </>
                    );
                  })()}
                </>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-1 text-base-content/60">
                    Prompt:
                  </p>
                  <div className="prompt-text overflow-y-scroll p-3 bg-base-200 rounded-lg text-sm line-clamp-16 break-words whitespace-pre-wrap">
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
              )}
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
        {showBottomHr && <hr className={lineClass} />}
      </li>
    );
  });

  const items = await Promise.all(eventItems);

  // Paginated request (offset > 0): append via OOB + replace sentinel
  if (offset > 0) {
    return (
      <>
        <div id="events-timeline" hx-swap-oob="beforeend">
          {items}
        </div>
        {hasMore ? (
          renderSentinel(jobId, offset + limit, source)
        ) : (
          <div id="events-sentinel" className="py-6 text-center text-base-content/40 text-sm">
            No more events
          </div>
        )}
      </>
    );
  }

  // Initial load (offset === 0): render timeline + sentinel
  return (
    <>
      <ul id="events-timeline" className="timeline timeline-compact timeline-vertical">
        {items}
      </ul>
      {hasMore ? renderSentinel(jobId, offset + limit, source) : null}
    </>
  );
};

function escapeForJsString(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}
