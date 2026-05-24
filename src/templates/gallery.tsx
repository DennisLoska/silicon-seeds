interface GalleryItem {
  meta_id: string;
  event_id: string;
  filename: string;
  subfolder: string;
  type: "input" | "output" | "temp";
  created_at: string;
  job_id: string;
  mediaType: "image" | "video" | null;
}

interface GalleryProps {
  items: GalleryItem[];
  typeFilter?: string;
}

function getAssetPath(subfolder: string, filename: string) {
  const cleanSubfolder = subfolder.endsWith("/")
    ? subfolder.slice(0, -1)
    : subfolder;

  if (!cleanSubfolder || cleanSubfolder.trim() === "") {
    return `/assets/${filename}`;
  }

  return `/assets/${cleanSubfolder}/${filename}`;
}

export const Gallery = async ({ items, typeFilter }: GalleryProps) => {
  // Parse type filter - can be comma-separated for multiple selections
  const selectedTypes = typeFilter ? typeFilter.split(",") : [];

  return (
    <div className="flex flex-col" id="gallery-content">
      {/* Media Type Filter Controls */}
      <div className="sticky top-0 z-10 p-6 bg-base-100 mb-4 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="gallery-type-filter"
              value="all"
              checked={
                selectedTypes.length === 0 || selectedTypes.includes("all")
              }
              className="checkbox checkbox-sm checkbox-accent"
              hx-get="/gallery"
              hx-trigger="change"
              hx-target="#gallery-content"
            />
            <span className="text-sm font-semibold">All</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="gallery-type-filter"
              value="image"
              checked={selectedTypes.includes("image")}
              className="checkbox checkbox-sm checkbox-accent"
              hx-get="/gallery?type=image"
              hx-trigger="change"
              hx-target="#gallery-content"
            />
            <span className="text-sm font-semibold">Images</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="gallery-type-filter"
              value="video"
              checked={selectedTypes.includes("video")}
              className="checkbox checkbox-sm checkbox-accent"
              hx-get="/gallery?type=video"
              hx-trigger="change"
              hx-target="#gallery-content"
            />
            <span className="text-sm font-semibold">Videos</span>
          </label>
        </div>
      </div>

      {/* Masonry Gallery */}
      <div
        id="gallery-grid"
        className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 p-6 gap-4 space-y-4"
        aria-live="polite"
      >
        {items.map((item) => {
          if (!item.mediaType) return null;
          return <GalleryItemCard key={item.meta_id} item={item} />;
        })}

        {/* Infinite Scroll Sentinel - last element triggers load */}
        <div
          className="sentinel hidden py-8 text-center break-inside-avoid"
          hx-get="/gallery/items"
          hx-trigger="revealed"
          hx-swap="afterend"
          hx-on:revealed="this.querySelector('.loading').remove()"
          hx-vals={`{"cursor": "${items[items.length - 1]?.meta_id || ""}", "type": "${typeFilter || "all"}"}`}
        >
          <span className="loading loading-spinner"></span>
        </div>
      </div>
    </div>
  );
};

// Static method to render items fragment for HTMX requests
export async function renderItems(
  items: GalleryItem[],
  cursor: string,
  typeFilter?: string,
) {
  const nextCursor = items[items.length - 1]?.meta_id || "";

  return (
    <>
      {/* Gallery items to append */}
      {items.map((item) => {
        if (!item.mediaType) return null;
        return <GalleryItemCard key={item.meta_id} item={item} />;
      })}
      {/* New sentinel for next batch - replaces the old one via afterend swap */}
      <div
        className="sentinel hidden py-8 text-center break-inside-avoid"
        hx-get="/gallery/items"
        hx-trigger="revealed"
        hx-swap="afterend"
        hx-on:revealed="this.querySelector('.loading').remove()"
        hx-vals={`{"cursor": "${nextCursor}", "type": "${typeFilter || "all"}"}`}
      >
        <span className="loading loading-spinner"></span>
      </div>
    </>
  );
}

// Gallery Item Card Component
const GalleryItemCard = ({ item }: { item: GalleryItem }) => {
  const assetPath = getAssetPath(item.subfolder, item.filename);
  const mediaType = item.mediaType;

  return (
    <div className="card bg-base-200 hover:scale-105 transition-transform duration-200 break-inside-avoid rounded-box">
      <figure className="bg-base-300 flex items-center justify-center overflow-hidden rounded-box">
        {mediaType === "image" && (
          <img
            src={assetPath}
            alt={item.filename}
            className="w-full"
            onError={() => {
              // Hide broken images gracefully - handled by CSS instead
            }}
          />
        )}
        {mediaType === "video" && (
          <video
            src={assetPath}
            className="w-full"
            muted
            loop
            playsInline
            preload="metadata"
            x-data="{ play() { this.$el.play(); }, pause() { this.$el.pause(); this.$el.currentTime = 0; } }"
            x-on:mouseenter="play()"
            x-on:mouseleave="pause()"
          />
        )}
      </figure>
    </div>
  );
};
