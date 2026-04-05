import { Job } from "../events/events";

interface MediaData {
  images: Array<{ filename: string; subfolder: string; type: string; status: string }>;
  videos: Array<{ filename: string; subfolder: string; type: string; status: string }>;
  audio: Array<{ filename: string; subfolder: string; type: string; status: string }>;
  pending: Array<{ mode: string; filename: string | null; status: string }>;
}

export const media = async (job: Job, mediaData?: MediaData) => {
  // Default empty media data if not provided
  const data = mediaData || {
    images: [],
    videos: [],
    audio: [],
    pending: [],
  };

  // Check if there are any assets at all
  const hasAssets = data.images.length > 0 || data.videos.length > 0 || data.audio.length > 0 || data.pending.length > 0;

  if (!hasAssets) {
    // Empty state - no media assets
    return (
      <div className="space-y-4">
        <h2 className="text-3xl font-bold mb-4">Media</h2>
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h2 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold">
              Media
            </h2>
            <p className="text-base-content/50">No media assets found for this job.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold mb-4">Media</h2>
      
      {/* Images Section */}
      {data.images.length > 0 && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold mb-3">
              Images
            </h3>
            <div className="carousel w-full">
              {data.images.map((image, index) => (
                <div key={index} className="carousel-item">
                  <div className="flex flex-col gap-2">
                    <img
                      src={`/assets/${image.subfolder}/${image.filename}`}
                      alt={`Image ${index + 1}`}
                      className="max-h-96 rounded-lg shadow-md"
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-base-content/50">{image.filename}</span>
                      <span className="badge badge-success">Complete</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Videos Section */}
      {data.videos.length > 0 && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold mb-3">
              Videos
            </h3>
            <div className="space-y-3">
              {data.videos.map((video, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <video controls className="w-full max-w-lg rounded-lg shadow-md">
                    <source src={`/assets/${video.subfolder}/${video.filename}`} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-base-content/50">{video.filename}</span>
                    <span className="badge badge-success">Complete</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audio Section */}
      {data.audio.length > 0 && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold mb-3">
              Audio
            </h3>
            <div className="space-y-3">
              {data.audio.map((audio, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <audio controls className="w-full max-w-lg">
                    <source src={`/assets/${audio.subfolder}/${audio.filename}`} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-base-content/50">{audio.filename}</span>
                    <span className="badge badge-success">Complete</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pending Assets Section */}
      {data.pending.length > 0 && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold mb-3">
              Pending
            </h3>
            <div className="space-y-2">
              {data.pending.map((asset, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm text-base-content/70">
                    {asset.mode === "speech" ? "Voiceover" : asset.mode === "instrumental" ? "Background Music" : asset.mode}
                  </span>
                  <span className="badge badge-warning">Generating...</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
