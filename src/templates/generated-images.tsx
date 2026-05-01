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
    if (
      evt.type === Event.NewImagePrompt &&
      evt.status === JobStatus.Complete
    ) {
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
      <div className="flex flex-col items-center justify-center gap-2 py-16">
        <p className="text-lg font-medium text-base-content/60">Generating</p>
        <span className="loading loading-dots loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-1 lg:columns-2 xl:columns-2 gap-3 space-y-3 max-w-full px-6">
      {images.map((img) => {
        const assetPath = img.subfolder
          ? `/assets/${img.subfolder}/${img.filename}`
          : `/assets/${img.filename}`;

        return (
          <div
            key={img.eventId}
            className="card bg-base-200 hover:scale-105 transition-transform duration-200 break-inside-avoid rounded-box mb-3"
          >
            <figure className="bg-base-300 overflow-hidden rounded-box">
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
