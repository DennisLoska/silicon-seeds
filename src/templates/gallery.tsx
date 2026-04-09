interface GalleryItem {
  meta_id: string;
  event_id: string;
  filename: string;
  subfolder: string;
  type: "input" | "output" | "temp";
  created_at: string;
  job_id: string;
  mediaType: "image" | "video" | "audio" | null;
}

interface GalleryProps {
  items: GalleryItem[];
  typeFilter?: string;
}

export const Gallery = async ({ items, typeFilter }: GalleryProps) => {
  return (
    <div class="flex flex-col h-full">
      {/* Media Type Filter Controls */}
      <div class="flex gap-2 mb-4 p-2 bg-base-200 rounded-lg">
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

        <input
          type="radio"
          name="gallery-type-filter"
          value="audio"
          checked={typeFilter === "audio"}
          class="btn btn-sm btn-outline"
          hx-get="/gallery?type=audio"
          hx-trigger="change"
          hx-target="body"
        />
        <label for="gallery-type-filter-audio" class="text-sm">
          Audio
        </label>
      </div>

      {/* Gallery Grid */}
      <div
        id="gallery-grid"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 flex-grow overflow-y-auto"
        aria-live="polite"
      >
        {items.map((item) => (
          <GalleryItemCard key={item.meta_id} item={item} />
        ))}
      </div>

      {/* Infinite Scroll Sentinel */}
      <div
        hx-get="/gallery/items"
        hx-trigger="revealed"
        hx-swap="beforeend"
        hx-target="#gallery-grid"
        hx-vals={`{cursor: "${items[items.length - 1]?.created_at || ""}"}`}
        class="py-4 text-center"
      >
        <span class="loading loading-spinner"></span>
      </div>
    </div>
  );
};

// Static method to render items fragment for HTMX requests
export async function renderItems(items: GalleryItem[]) {
  return (
    <>
      {items.map((item) => (
        <GalleryItemCard key={item.meta_id} item={item} />
      ))}
    </>
  );
}

// Gallery Item Card Component
const GalleryItemCard = ({ item }: { item: GalleryItem }) => {
  const assetPath = `/assets/${item.subfolder || ""}/${item.filename}`;
  const mediaType = item.mediaType;

  return (
    <div class="card bg-base-200 hover:scale-105 transition-transform duration-200">
      <figure class="aspect-square bg-base-300 flex items-center justify-center overflow-hidden">
        {mediaType === "image" && (
          <img
            src={assetPath}
            alt={item.filename}
            class="w-full h-full object-contain"
            onError={() => {
              // Hide broken images gracefully - handled by CSS instead
            }}
          />
        )}
        {mediaType === "video" && (
          <video src={assetPath} class="w-full h-full object-contain" muted />
        )}
        {mediaType === "audio" && <div class="text-6xl">🎵</div>}
        {!mediaType && <div class="text-4xl">📁</div>}
      </figure>
    </div>
  );
};
