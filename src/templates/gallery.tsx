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

type GalleryColumn = {
  items: GalleryItem[];
};

function getAssetPath(subfolder: string, filename: string) {
  const cleanSubfolder = subfolder.endsWith("/")
    ? subfolder.slice(0, -1)
    : subfolder;

  if (!cleanSubfolder || cleanSubfolder.trim() === "") {
    return `/assets/${filename}`;
  }

  return `/assets/${cleanSubfolder}/${filename}`;
}

function splitIntoColumns(items: GalleryItem[], columnCount: number): GalleryColumn[] {
  const visibleItems = items.filter((item) => item.mediaType);
  const columns = Array.from({ length: columnCount }, () => ({
    items: [],
  })) as GalleryColumn[];

  visibleItems.forEach((item, index) => {
    columns[index % columnCount].items.push(item);
  });

  return columns;
}

function getColumnVisibilityClass(index: number) {
  switch (index) {
    case 0:
      return "block";
    case 1:
      return "hidden sm:block";
    case 2:
      return "hidden lg:block";
    case 3:
      return "hidden xl:block";
    default:
      return "hidden 2xl:block";
  }
}

function renderSentinel(cursor: string, typeFilter?: string, oob = false) {
  return (
    <div
      id="gallery-sentinel"
      className="sentinel hidden py-8 text-center"
      hx-get="/gallery/items"
      hx-trigger="revealed"
      hx-swap={oob ? "outerHTML" : "afterend"}
      hx-swap-oob={oob ? "true" : undefined}
      hx-on:revealed="this.querySelector('.loading').remove()"
      hx-vals={`{"cursor": "${cursor}", "type": "${typeFilter || "all"}"}`}
    >
      <span className="loading loading-spinner"></span>
    </div>
  );
}

function renderColumnItems(items: GalleryItem[]) {
  return items.map((item) => <GalleryItemCard key={item.meta_id} item={item} />);
}

function renderColumnAppendFragments(columns: GalleryColumn[]) {
  return columns.map((column, index) => {
    if (column.items.length === 0) return null;

    return (
      <div key={`gallery-column-append-${index}`} id={`gallery-column-${index}`} hx-swap-oob="beforeend">
        {renderColumnItems(column.items)}
      </div>
    );
  });
}

export const Gallery = async ({ items, typeFilter }: GalleryProps) => {
  // Parse type filter - can be comma-separated for multiple selections
  const selectedTypes = typeFilter ? typeFilter.split(",") : [];
  const columns = splitIntoColumns(items, 5);

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
      <div id="gallery-grid" className="p-6" aria-live="polite">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-start">
          {columns.map((column, index) => (
            <div
              key={`gallery-column-${index}`}
              id={`gallery-column-${index}`}
              className={`${getColumnVisibilityClass(index)} space-y-4`}
            >
              {renderColumnItems(column.items)}
            </div>
          ))}
        </div>
        {items.length > 0
          ? renderSentinel(items[items.length - 1]?.meta_id || "", typeFilter)
          : null}
      </div>
    </div>
  );
};

// Static method to render items fragment for HTMX requests
export async function renderItems(
  items: GalleryItem[],
  _cursor: string,
  typeFilter?: string,
) {
  const visibleItems = items.filter((item) => item.mediaType);
  const nextCursor = visibleItems[visibleItems.length - 1]?.meta_id || "";
  const columns = splitIntoColumns(visibleItems, 5);

  return (
    <>
      {renderColumnAppendFragments(columns)}
      {nextCursor ? renderSentinel(nextCursor, typeFilter, true) : null}
    </>
  );
}

// Gallery Item Card Component
const GalleryItemCard = ({ item }: { item: GalleryItem }) => {
  const assetPath = getAssetPath(item.subfolder, item.filename);
  const mediaType = item.mediaType;

  return (
    <div className="card bg-base-200 hover:scale-105 transition-transform duration-200 rounded-box h-fit">
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
