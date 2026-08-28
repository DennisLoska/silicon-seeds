import { createSignal, createResource, For, Show, onMount, createEffect } from "solid-js";
import { apiGet, type GalleryItem, getAssetPath } from "../api/client";

function splitIntoColumns(items: GalleryItem[], count: number) {
  const cols = Array.from({ length: count }, () => [] as GalleryItem[]);
  items.forEach((item, i) => cols[i % count].push(item));
  return cols;
}

function GalleryCard(props: { item: GalleryItem }) {
  const path = () => getAssetPath(props.item.subfolder, props.item.filename);
  return (
    <div
      class="card bg-base-200 hover:scale-105 transition-transform duration-200 break-inside-avoid rounded-box"
      style="content-visibility:auto; contain-intrinsic-size: 300px 300px;"
    >
      <figure class="bg-base-300 flex items-center justify-center overflow-hidden rounded-box">
        <Show
          when={props.item.mediaType === "image"}
          fallback={
            <video src={path()} controls preload="metadata" class="w-full h-auto" loading="lazy" />
          }
        >
          <img src={path()} alt={props.item.filename} class="w-full h-auto" loading="lazy" decoding="async" />
        </Show>
      </figure>
      <div class="card-body p-3">
        <p class="text-xs truncate opacity-60">{props.item.filename}</p>
      </div>
    </div>
  );
}

export default function Gallery() {
  const [type, setType] = createSignal<string>("all");
  const [cursor, setCursor] = createSignal<string | undefined>(undefined);
  const [items, setItems] = createSignal<GalleryItem[]>([]);
  const [hasMore, setHasMore] = createSignal(true);
  const [loading, setLoading] = createSignal(false);

  const fetchItems = async (reset = false) => {
    if (loading()) return;
    setLoading(true);
    const c = reset ? undefined : cursor();
    const t = type();
    const q = new URLSearchParams();
    if (c) q.set("cursor", c);
    if (t && t !== "all") q.set("type", t);
    q.set("limit", "20");
    try {
      const data = await apiGet<{ items: GalleryItem[] }>(`/api/gallery/items?${q.toString()}`);
      const fetched = data.items ?? [];
      if (reset) {
        setItems(fetched);
      } else {
        setItems((prev) => [...prev, ...fetched]);
      }
      if (fetched.length > 0) setCursor(fetched[fetched.length - 1].meta_id);
      if (fetched.length < 20) setHasMore(false);
      if (fetched.length === 0) setHasMore(false);
    } catch (e) {
      console.error(e);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  // initial + type change
  createEffect(() => {
    type(); // track
    setItems([]);
    setCursor(undefined);
    setHasMore(true);
    fetchItems(true);
  });

  let sentinelRef: HTMLDivElement | undefined;
  onMount(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore() && !loading()) fetchItems(false);
      },
      { rootMargin: "200px" },
    );
    if (sentinelRef) obs.observe(sentinelRef);
    return () => obs.disconnect();
  });

  const columns = () => splitIntoColumns(items(), 5);
  const colClass = (i: number) => {
    switch (i) {
      case 0: return "block";
      case 1: return "hidden sm:block";
      case 2: return "hidden lg:block";
      case 3: return "hidden xl:block";
      default: return "hidden 2xl:block";
    }
  };

  return (
    <div class="flex flex-col" id="gallery-content">
      <div class="sticky top-0 z-10 p-6 bg-base-100 mb-4 rounded-lg shadow-sm">
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={type() === "all" || type() === ""}
              onChange={() => setType("all")}
              class="checkbox checkbox-sm checkbox-accent"
            />
            <span class="text-sm font-semibold">All</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={type() === "image"}
              onChange={() => setType(type() === "image" ? "all" : "image")}
              class="checkbox checkbox-sm checkbox-accent"
            />
            <span class="text-sm font-semibold">Images</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={type() === "video"}
              onChange={() => setType(type() === "video" ? "all" : "video")}
              class="checkbox checkbox-sm checkbox-accent"
            />
            <span class="text-sm font-semibold">Videos</span>
          </label>
        </div>
      </div>
      <div id="gallery-grid" class="p-6" aria-live="polite">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 items-start">
          <For each={columns()}>
            {(col, idx) => (
              <div id={`gallery-column-${idx()}`} class={`${colClass(idx())} space-y-4`}>
                <For each={col}>{(item) => <GalleryCard item={item} />}</For>
              </div>
            )}
          </For>
        </div>
        <div ref={sentinelRef} id="gallery-sentinel" class="py-8 text-center">
          <Show when={loading()}>
            <span class="loading loading-spinner" />
          </Show>
          <Show when={!hasMore() && items().length > 0}>
            <div class="text-center py-8 text-base-content/60" style="column-span:all">No more items</div>
          </Show>
          <Show when={!loading() && items().length === 0 && !hasMore()}>
            <div class="text-base-content/60">No items</div>
          </Show>
        </div>
      </div>
    </div>
  );
}
