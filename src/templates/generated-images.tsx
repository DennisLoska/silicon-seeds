import { DB } from "../db/db";
import { Event, JobStatus } from "../events/events";

export interface GeneratedImagesProps {
  jobId: string;
}

export const GeneratedImages = async ({ jobId }: GeneratedImagesProps) => {
  const jobEvents = await DB.Events.findByJobId(jobId);

  // Filter for completed image events and fetch their metadata
  const images = [];
  for (const evt of jobEvents) {
    if (evt.type === Event.NewImagePrompt && evt.status === JobStatus.Complete) {
      const assetMeta = await DB.Meta.findByEventId(evt.id).catch(() => null);
      if (assetMeta) {
        images.push({
          eventId: evt.id,
          filename: assetMeta.filename,
          subfolder: assetMeta.subfolder,
          index: evt.index ?? 0,
        });
      }
    }
  }

  // Sort by index so images appear in order
  images.sort((a, b) => a.index - b.index);

  if (images.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-12 h-12 mx-auto mb-3 text-base-content/30"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 gap-3">
      {images.map((img) => {
        const assetPath = img.subfolder
          ? `/assets/${img.subfolder}/${img.filename}`
          : `/assets/${img.filename}`;

        return (
          <div
            key={img.eventId}
            className="card bg-base-200 hover:scale-105 transition-transform duration-200 break-inside-avoid rounded-box mb-3"
          >
            <figure className="bg-base-300 flex items-center justify-center overflow-hidden rounded-box">
              <img
                src={assetPath}
                alt={`Generated image ${img.index + 1}`}
                className="w-full h-auto"
              />
            </figure>
          </div>
        );
      })}
    </div>
  );
};
