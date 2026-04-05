import { Job } from "../events/events";

interface MediaData {
  images: Array<{ filename: string; subfolder: string; type: string; status: string }>;
  videos: Array<{ filename: string; subfolder: string; type: string; status: string }>;
  audio: Array<{ filename: string; subfolder: string; type: string; status: string }>;
  pending: Array<{ mode: string; filename: string | null; status: string }>;
}

function getAssetPath(subfolder: string, filename: string): string {
  const cleanSubfolder = subfolder.endsWith("/") ? subfolder.slice(0, -1) : subfolder;
  if (!cleanSubfolder || cleanSubfolder.trim() === "") {
    return `/assets/${filename}`;
  }
  return `/assets/${cleanSubfolder}/${filename}`;
}

const DOWNLOAD_ICON_SMALL = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const INFO_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
  </svg>
);

const renderMediaItem = (asset: { filename: string; subfolder: string }, type: "image" | "video" | "audio") => {
  const assetPath = getAssetPath(asset.subfolder, asset.filename);
  return (
    <div key={asset.filename} className="bg-base-200 rounded-lg p-4" style={{ width: 'fit-content' }}>
      {type === "image" ? (
        <img src={assetPath} alt={asset.filename} className="rounded-lg shadow-md w-full" style={{ maxHeight: '24rem', objectFit: 'contain' }} />
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
        <a href={assetPath} download className="btn btn-xs btn-circle btn-ghost ml-2">
          {DOWNLOAD_ICON_SMALL}
        </a>
      </div>
    </div>
  );
};

const renderEmptyState = (message: string) => (
  <div className="alert alert-info" style={{ width: 'fit-content' }}>
    {INFO_ICON}
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
  <div className="card shadow-sm bg-base-200" style={{ width: 'fit-content', minWidth: '300px', maxWidth: '100%', resize: 'both', overflow: 'auto' }}>
    <div className="card-body p-4">
      <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold mb-3">{title}</h3>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-4">
          {items.map(asset => renderMediaItem(asset, type))}
        </div>
      ) : renderEmptyState(emptyMessage)}
    </div>
  </div>
);

export const media = async (job: Job, mediaData?: MediaData) => {
  const data = mediaData || { images: [], videos: [], audio: [], pending: [] };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold mb-4">Media</h2>
      <MediaCard title="Images" items={data.images} type="image" emptyMessage="No images found for this job." />
      <MediaCard title="Videos" items={data.videos} type="video" emptyMessage="No videos found for this job." />
      <MediaCard title="Audio" items={data.audio} type="audio" emptyMessage="No audios found for this job." />
    </div>
  );
};
