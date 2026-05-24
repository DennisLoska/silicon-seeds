import { Icons } from "./icons";
import { Event } from "../events/events";
import { getAssetPath } from "./utils";

export interface MediaData {
  images: Array<{
    eventId: string;
    jobId: string;
    eventType: Event;
    filename: string;
    subfolder: string;
    type: string;
    status: string;
  }>;
  videos: Array<{
    eventId: string;
    jobId: string;
    eventType: Event;
    filename: string;
    subfolder: string;
    type: string;
    status: string;
  }>;
  audio: Array<{
    eventId: string;
    jobId: string;
    eventType: Event;
    filename: string;
    subfolder: string;
    type: string;
    status: string;
  }>;
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
      className="bg-base-200 rounded-lg p-4 hover:scale-105 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
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
}

const MediaCard = ({ title, items, pendingCount = 0, type, emptyMessage }: MediaCardProps) => (
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
        <div className="flex flex-wrap gap-4">
          {items.map((asset) => renderMediaItem(asset, type))}
          {Array.from({ length: pendingCount }, (_, index) =>
            renderSkeletonCard(type, `${title}-pending-${index}`),
          )}
        </div>
      ) : (
        renderEmptyState(emptyMessage)
      )}
    </div>
  </div>
);

export const Media = async (mediaData: MediaData) => {
  const data = mediaData || { images: [], videos: [], audio: [], pending: [] };
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

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold mb-4">Media</h2>
      <MediaCard
        title="Images"
        items={data.images}
        pendingCount={pendingImages}
        type="image"
        emptyMessage="No images found for this job."
      />
      <MediaCard
        title="Videos"
        items={data.videos}
        pendingCount={pendingVideos}
        type="video"
        emptyMessage="No videos found for this job."
      />
      <MediaCard
        title="Audio"
        items={data.audio}
        pendingCount={pendingAudio}
        type="audio"
        emptyMessage="No audios found for this job."
      />
    </div>
  );
};
