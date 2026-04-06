import { Job } from "../events/events";
import { Icons } from "./icons";

interface MediaData {
  images: Array<{
    filename: string;
    subfolder: string;
    type: string;
    status: string;
  }>;
  videos: Array<{
    filename: string;
    subfolder: string;
    type: string;
    status: string;
  }>;
  audio: Array<{
    filename: string;
    subfolder: string;
    type: string;
    status: string;
  }>;
  pending: Array<{ mode: string; filename: string | null; status: string }>;
}

function getAssetPath(subfolder: string, filename: string): string {
  const cleanSubfolder = subfolder.endsWith("/")
    ? subfolder.slice(0, -1)
    : subfolder;
  if (!cleanSubfolder || cleanSubfolder.trim() === "") {
    return `/assets/${filename}`;
  }
  return `/assets/${cleanSubfolder}/${filename}`;
}

const renderMediaItem = (
  asset: { filename: string; subfolder: string },
  type: "image" | "video" | "audio",
) => {
  const assetPath = getAssetPath(asset.subfolder, asset.filename);
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
      <div className="flex justify-start items-center mt-2">
        <span className="text-xs text-base-content/50">{asset.filename}</span>
        <a
          href={assetPath}
          download
          className="btn btn-xs btn-circle btn-ghost ml-2"
        >
          {Icons.DOWNLOAD_ICON_SMALL}
        </a>
      </div>
    </div>
  );
};

const renderEmptyState = (message: string) => (
  <div className="alert alert-info" style={{ width: "fit-content" }}>
    {Icons.INFO_ICON}
    <span className="font-bold">{message}</span>
  </div>
);

interface MediaCardProps {
  title: string;
  items: Array<{ filename: string; subfolder: string }>;
  type: "image" | "video" | "audio";
  emptyMessage: string;
}

const MediaCard = ({ title, items, type, emptyMessage }: MediaCardProps) => (
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
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-4">
          {items.map((asset) => renderMediaItem(asset, type))}
        </div>
      ) : (
        renderEmptyState(emptyMessage)
      )}
    </div>
  </div>
);

export const media = async (job: Job, mediaData?: MediaData) => {
  const data = mediaData || { images: [], videos: [], audio: [], pending: [] };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold mb-4">Media</h2>
      <MediaCard
        title="Images"
        items={data.images}
        type="image"
        emptyMessage="No images found for this job."
      />
      <MediaCard
        title="Videos"
        items={data.videos}
        type="video"
        emptyMessage="No videos found for this job."
      />
      <MediaCard
        title="Audio"
        items={data.audio}
        type="audio"
        emptyMessage="No audios found for this job."
      />
    </div>
  );
};
