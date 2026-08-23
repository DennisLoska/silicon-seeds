import { Icons } from "./icons";
import { Event } from "../events/events";
import { getAssetPath } from "./utils";

export type MediaAsset = {
  eventId: string;
  jobId: string;
  eventType: Event;
  filename: string;
  subfolder: string;
  type: string;
  status: string;
};

export interface MediaData {
  images: MediaAsset[];
  videos: MediaAsset[];
  audio: MediaAsset[];
  pending: Array<{
    eventId: string;
    jobId: string;
    eventType: Event;
    mode: string;
    filename: string | null;
    status: string;
  }>;
}

function renderSkeletonCard(type: "image" | "video" | "audio", key: string) {
  return (
    <div
      key={key}
      className="bg-base-200 rounded-lg p-4 animate-pulse"
      style={{ width: "fit-content" }}
    >
      {type === "image" ? (
        <div className="skeleton rounded-lg w-[20rem] max-w-full h-[18rem]"></div>
      ) : type === "video" ? (
        <div className="skeleton rounded-lg w-[28rem] max-w-full h-[16rem]"></div>
      ) : (
        <div className="space-y-2 w-[28rem] max-w-full">
          <div className="skeleton h-10 w-full"></div>
          <div className="skeleton h-4 w-1/2"></div>
        </div>
      )}
      <div className="flex items-center mt-2 gap-2">
        <div className="skeleton h-3 w-32"></div>
        <div className="skeleton h-6 w-6 rounded-full"></div>
      </div>
    </div>
  );
}

const renderMediaItem = (
  asset: {
    eventId: string;
    jobId: string;
    eventType: Event;
    filename: string;
    subfolder: string;
  },
  type: "image" | "video" | "audio",
) => {
  const assetPath = getAssetPath(asset.subfolder, asset.filename);
  const canRegenerate =
    asset.eventType === Event.NewImagePrompt ||
    asset.eventType === Event.NewVideoPrompt ||
    asset.eventType === Event.NewTransitionPrompt;

  return (
    <div
      key={asset.filename}
      className="bg-base-200 rounded-lg p-4"
      style={{ width: "fit-content" }}
    >
      {type === "image" ? (
        <img
          src={assetPath}
          alt={asset.filename}
          className="rounded-lg shadow-md w-full"
          style={{ maxHeight: "24rem", objectFit: "contain" }}
        />
      ) : type === "video" ? (
        <video controls className="w-full max-w-lg rounded-lg shadow-md">
          <source src={assetPath} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      ) : (
        <audio controls className="w-full max-w-lg">
          <source src={assetPath} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      )}
      <div className="flex justify-start items-center mt-2 gap-2">
        <span className="text-xs text-base-content/50">{asset.filename}</span>
        {canRegenerate && (
          <button
            type="button"
            className="btn btn-xs btn-circle btn-ghost"
            title="Regenerate"
            hx-post={`/api/jobs/${asset.jobId}/events/${asset.eventId}/regenerate?tab=media`}
            hx-target="#job-content-area"
            hx-swap="outerHTML"
          >
            <Icons.RegenerateIconSmall />
          </button>
        )}
        <a
          href={assetPath}
          download
          className="btn btn-xs btn-circle btn-ghost ml-2"
        >
          <Icons.DownloadIconSmall />
        </a>
      </div>
    </div>
  );
};

const renderEmptyState = (message: string) => (
  <div className="alert alert-info" style={{ width: "fit-content" }}>
    <Icons.InfoIcon />
    <span className="font-bold">{message}</span>
  </div>
);

const MEDIA_PAGE_SIZE = 12;

function renderMediaSentinel(jobId: string, type: "image" | "video" | "audio", offset: number) {
  return (
    <div
      id={`media-${type}-sentinel`}
      className="py-4 text-center w-full"
      hx-get={`/jobs/media-items?job_id=${jobId}&type=${type}&offset=${offset}&limit=${MEDIA_PAGE_SIZE}`}
      hx-trigger="intersect once threshold:0.1 root:#jobs-main-scroll"
      hx-swap="outerHTML"
    >
      <span className="loading loading-spinner loading-sm"></span>
    </div>
  );
}

interface MediaCardProps {
  title: string;
  items: Array<{
    eventId: string;
    jobId: string;
    eventType: Event;
    filename: string;
    subfolder: string;
  }>;
  pendingCount?: number;
  type: "image" | "video" | "audio";
  emptyMessage: string;
  jobId?: string;
  hasMore?: boolean;
  nextOffset?: number;
}

const MediaCard = ({ title, items, pendingCount = 0, type, emptyMessage, jobId, hasMore, nextOffset }: MediaCardProps) => (
  <div
    className="card shadow-sm bg-base-200"
    style={{
      width: "fit-content",
      minWidth: "300px",
      maxWidth: "100%",
      resize: "both",
      overflow: "auto",
    }}
  >
    <div className="card-body p-4">
      <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold mb-3">
        {title}
      </h3>
      {items.length > 0 || pendingCount > 0 ? (
        <>
          <div id={`media-${type}-container`} className="flex flex-wrap gap-4">
            {items.map((asset) => renderMediaItem(asset, type))}
            {Array.from({ length: pendingCount }, (_, index) =>
              renderSkeletonCard(type, `${title}-pending-${index}`),
            )}
          </div>
          {jobId && hasMore && nextOffset !== undefined
            ? renderMediaSentinel(jobId, type, nextOffset)
            : null}
        </>
      ) : (
        renderEmptyState(emptyMessage)
      )}
    </div>
  </div>
);

export const Media = async (mediaData: MediaData & { jobId?: string }) => {
  const data = mediaData || { images: [], videos: [], audio: [], pending: [] };
  const jobId = (mediaData as unknown as { jobId?: string }).jobId || data.images[0]?.jobId || data.videos[0]?.jobId || data.audio[0]?.jobId || "";
  const pendingImages = data.pending.filter(
    (asset) => asset.eventType === Event.NewImagePrompt,
  ).length;
  const pendingVideos = data.pending.filter(
    (asset) =>
      asset.eventType === Event.NewVideoPrompt ||
      asset.eventType === Event.NewTransitionPrompt,
  ).length;
  const pendingAudio = data.pending.filter(
    (asset) => asset.eventType === Event.NewAudioPrompt,
  ).length;

  // Paginate initial view to MEDIA_PAGE_SIZE per type
  const paginatedImages = data.images.slice(0, MEDIA_PAGE_SIZE);
  const paginatedVideos = data.videos.slice(0, MEDIA_PAGE_SIZE);
  const paginatedAudio = data.audio.slice(0, MEDIA_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold mb-4">Media</h2>
      <MediaCard
        title="Images"
        items={paginatedImages}
        pendingCount={pendingImages}
        type="image"
        emptyMessage="No images found for this job."
        jobId={jobId}
        hasMore={data.images.length > MEDIA_PAGE_SIZE}
        nextOffset={MEDIA_PAGE_SIZE}
      />
      <MediaCard
        title="Videos"
        items={paginatedVideos}
        pendingCount={pendingVideos}
        type="video"
        emptyMessage="No videos found for this job."
        jobId={jobId}
        hasMore={data.videos.length > MEDIA_PAGE_SIZE}
        nextOffset={MEDIA_PAGE_SIZE}
      />
      <MediaCard
        title="Audio"
        items={paginatedAudio}
        pendingCount={pendingAudio}
        type="audio"
        emptyMessage="No audios found for this job."
        jobId={jobId}
        hasMore={data.audio.length > MEDIA_PAGE_SIZE}
        nextOffset={MEDIA_PAGE_SIZE}
      />
    </div>
  );
};

export async function renderMediaItems(
  jobId: string,
  type: "image" | "video" | "audio",
  offset: number,
  limit: number,
) {
  // Reuse buildMediaData logic via DB query to avoid full load overhead for large offset
  // For now, load all and slice — 177 rows is cheap, HTML is expensive
  const { DB } = await import("../db/db");
  const events = await DB.Events.findByJobId(jobId);
  const completedEvents = events.filter((e) => e.status !== "pending");
  const ids = completedEvents.map((e) => e.id);
  const metas = await DB.Meta.findManyByEventIds(ids);
  const metaById = new Map(metas.map((m) => [m.event_id, m]));
  const allAssets: Array<{ asset: MediaAsset; mode: string; filename: string }> = [];
  for (const event of completedEvents) {
    const meta = metaById.get(event.id);
    if (!meta) continue;
    const asset: MediaAsset = {
      eventId: event.id,
      jobId: event.jobId,
      eventType: event.type,
      filename: meta.filename,
      subfolder: meta.subfolder,
      type: meta.type,
      status: event.status,
    };
    const isImageFile = meta.filename?.endsWith(".png");
    let assetType: "image" | "video" | "audio" | null = null;
    if (event.mode === "image" || isImageFile) assetType = "image";
    else if (event.mode === "video") assetType = "video";
    else if (event.mode === "speech" || event.mode === "song" || event.mode === "instrumental") assetType = "audio";
    if (assetType === type) allAssets.push({ asset, mode: assetType, filename: meta.filename });
  }
  const page = allAssets.slice(offset, offset + limit);
  const hasMore = allAssets.length > offset + limit;
  const items = page.map(({ asset }) => renderMediaItem(asset, type));
  const nextOffset = offset + limit;
  return (
    <>
      <div id={`media-${type}-container`} hx-swap-oob="beforeend">
        {items}
      </div>
      {hasMore ? (
        renderMediaSentinel(jobId, type, nextOffset)
      ) : (
        <div id={`media-${type}-sentinel`} className="py-2 text-center text-base-content/40 text-sm w-full">
          No more {type}s
        </div>
      )}
    </>
  );
}

