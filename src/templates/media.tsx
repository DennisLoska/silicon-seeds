import { Job } from "../events/events";

interface MediaData {
  images: Array<{ filename: string; subfolder: string; type: string; status: string }>;
  videos: Array<{ filename: string; subfolder: string; type: string; status: string }>;
  audio: Array<{ filename: string; subfolder: string; type: string; status: string }>;
  pending: Array<{ mode: string; filename: string | null; status: string }>;
}

// Helper function to construct asset path
function getAssetPath(subfolder: string, filename: string): string {
  // Remove trailing slash from subfolder if present
  const cleanSubfolder = subfolder.endsWith("/") ? subfolder.slice(0, -1) : subfolder;
  // Handle empty subfolder - return just filename
  // Files are stored in OUTPUT_DIR/<filename>, so we serve them at /assets/<filename>
  if (!cleanSubfolder || cleanSubfolder.trim() === "") {
    return `/assets/${filename}`;
  }
  // Files are stored in OUTPUT_DIR/<subfolder>/<filename>
  return `/assets/${cleanSubfolder}/${filename}`;
}

export const media = async (job: Job, mediaData?: MediaData) => {
  // Default empty media data if not provided
  const data = mediaData || {
    images: [],
    videos: [],
    audio: [],
    pending: [],
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold mb-4">Media</h2>
      
      {/* Images Section */}
      <div className="card shadow-sm bg-base-200" style={{ width: 'fit-content', minWidth: '300px' }}>
        <div className="card-body p-4">
          <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold mb-3">
            Images
          </h3>
          {data.images.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {data.images.map((image, index) => (
                <div key={index} className="bg-base-200 rounded-lg p-4" style={{ width: 'fit-content' }}>
                  <div className="relative">
                    <img
                      src={getAssetPath(image.subfolder, image.filename)}
                      alt={`Image ${index + 1}`}
                      className="rounded-lg shadow-md w-full" style={{ maxHeight: '24rem', objectFit: 'contain' }}
                    />
                    <a href={getAssetPath(image.subfolder, image.filename)} download className="absolute top-2 right-2 btn btn-sm btn-circle btn-ghost">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </a>
                  </div>
                  <div className="flex justify-start items-center mt-2">
                    <span className="text-xs text-base-content/50">{image.filename}</span>
                    <a href={getAssetPath(image.subfolder, image.filename)} download className="btn btn-xs btn-circle btn-ghost ml-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="alert alert-info" style={{ width: 'fit-content' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="font-bold">No images found for this job.</span>
            </div>
          )}
        </div>
      </div>

      {/* Videos Section */}
      <div className="card shadow-sm bg-base-200" style={{ width: 'fit-content', minWidth: '300px' }}>
        <div className="card-body p-4">
          <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold mb-3">
            Videos
          </h3>
          {data.videos.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {data.videos.map((video, index) => (
                <div key={index} className="bg-base-200 rounded-lg p-4" style={{ width: 'fit-content' }}>
                  <video controls className="w-full max-w-lg rounded-lg shadow-md">
                    <source src={getAssetPath(video.subfolder, video.filename)} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                  <div className="flex justify-start items-center mt-2">
                    <span className="text-xs text-base-content/50">{video.filename}</span>
                    <a href={getAssetPath(video.subfolder, video.filename)} download className="btn btn-xs btn-circle btn-ghost ml-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="alert alert-info" style={{ width: 'fit-content' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="font-bold">No videos found for this job.</span>
            </div>
          )}
        </div>
      </div>

      {/* Audio Section */}
      <div className="card shadow-sm bg-base-200" style={{ width: 'fit-content', minWidth: '300px' }}>
        <div className="card-body p-4">
          <h3 className="card-title text-base-content/70 text-sm uppercase tracking-widest font-bold mb-3">
            Audio
          </h3>
          {data.audio.length > 0 ? (
            <div className="flex flex-wrap gap-4">
              {data.audio.map((audio, index) => (
                <div key={index} className="bg-base-200 rounded-lg p-4" style={{ width: 'fit-content' }}>
                  <audio controls className="w-full max-w-lg">
                    <source src={getAssetPath(audio.subfolder, audio.filename)} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                  <div className="flex justify-start items-center mt-2">
                    <span className="text-xs text-base-content/50">{audio.filename}</span>
                    <a href={getAssetPath(audio.subfolder, audio.filename)} download className="btn btn-xs btn-circle btn-ghost ml-2">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="alert alert-info" style={{ width: 'fit-content' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span className="font-bold">No audios found for this job.</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
