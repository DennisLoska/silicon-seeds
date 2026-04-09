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

export const Gallery = async ({ items, typeFilter }: GalleryProps) => {
  return (
    <div class="flex flex-col">
      {/* Media Type Filter Controls */}
      <div class="flex gap-2 mb-4 p-2 bg-base-200 rounded-lg sticky top-0 z-10">
        <input
          type="radio"
          name="gallery-type-filter"
          value="all"
          checked={!typeFilter || typeFilter === "all"}
          class="btn btn-sm btn-outline"
          hx-get="/gallery"
          hx-trigger="change"
          hx-target="body"
        />
        <label for="gallery-type-filter-all" class="text-sm">
          All
        </label>

        <input
          type="radio"
          name="gallery-type-filter"
          value="image"
          checked={typeFilter === "image"}
          class="btn btn-sm btn-outline"
          hx-get="/gallery?type=image"
          hx-trigger="change"
          hx-target="body"
        />
        <label for="gallery-type-filter-image" class="text-sm">
          Images
        </label>

        <input
          type="radio"
          name="gallery-type-filter"
          value="video"
          checked={typeFilter === "video"}
          class="btn btn-sm btn-outline"
          hx-get="/gallery?type=video"
          hx-trigger="change"
          hx-target="body"
        />
        <label for="gallery-type-filter-video" class="text-sm">
          Videos
        </label>
      </div>

      {/* Masonry Gallery */}
      <div
        id="gallery-grid"
        class="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 p-6 gap-4 space-y-4"
        aria-live="polite"
      >
        {items.map((item) => (
          <GalleryItemCard key={item.meta_id} item={item} />
        ))}

        {/* Infinite Scroll Sentinel - last element triggers load */}
        <div
          class="sentinel hidden py-8 text-center break-inside-avoid"
          hx-get="/gallery/items"
          hx-trigger="revealed"
          hx-swap="afterend"
          hx-on:revealed="this.querySelector('.loading').remove()"
          hx-vals={`{"cursor": "${items[items.length - 1]?.meta_id || ""}", "type": "${typeFilter || "all"}"}`}
        >
          <span class="loading loading-spinner"></span>
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
      {items.map((item) => (
        <GalleryItemCard key={item.meta_id} item={item} />
      ))}
      {/* New sentinel for next batch - replaces the old one via afterend swap */}
      <div
        class="sentinel hidden py-8 text-center break-inside-avoid"
        hx-get="/gallery/items"
        hx-trigger="revealed"
        hx-swap="afterend"
        hx-on:revealed="this.querySelector('.loading').remove()"
        hx-vals={`{"cursor": "${nextCursor}", "type": "${typeFilter || "all"}"}`}
      >
        <span class="loading loading-spinner"></span>
      </div>
    </>
  );
}

// Gallery Item Card Component
const GalleryItemCard = ({ item }: { item: GalleryItem }) => {
  const assetPath = `/assets/${item.subfolder || ""}/${item.filename}`;
  const mediaType = item.mediaType;

  return (
    <div class="card bg-base-200 hover:scale-105 transition-transform duration-200 break-inside-avoid rounded-box">
      <figure class="bg-base-300 flex items-center justify-center overflow-hidden rounded-box">
        {mediaType === "image" && (
          <img
            src={assetPath}
            alt={item.filename}
            class="w-full"
            onError={() => {
              // Hide broken images gracefully - handled by CSS instead
            }}
          />
        )}
        {mediaType === "video" && (
          <video
            src={assetPath}
            class="w-full"
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
