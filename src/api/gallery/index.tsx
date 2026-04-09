import { Hono } from "hono";
import { Templates } from "../../templates/templates";
import { DB } from "../../db/db";
import {
  Gallery as GalleryTemplate,
  renderItems,
} from "../../templates/gallery";
import { Api } from "../api";

const app = new Hono();
const { OobHeader } = Templates;

// Main gallery page endpoint
app.get("/", async (c) => {
  const typeFilter = c.req.query("type") as string | undefined;

  // Fetch initial items for the gallery
  const initialItems = await DB.Gallery.listItems({
    limit: 20,
    type: typeFilter ? (typeFilter as "image" | "video") : undefined,
  });

  return Api.renderFragment(
    c,
    () => <GalleryTemplate items={initialItems} typeFilter={typeFilter} />,
    "gallery",
    () => <OobHeader title="Gallery" />,
  );
});

// Paginated items endpoint for infinite scroll
app.get("/items", async (c) => {
  const cursor = c.req.query("cursor") as string | undefined;
  const typeFilter = c.req.query("type") as string | undefined;
  const limit = parseInt(c.req.query("limit") || "20");

  console.log('[Gallery/items] Request params:', { cursor, typeFilter, limit });

  try {
    // Don't fetch if type is 'all' - treat as no filter
    const effectiveTypeFilter =
      typeFilter && typeFilter !== "all"
        ? (typeFilter as "image" | "video")
        : undefined;

    console.log('[Gallery/items] Effective type filter:', effectiveTypeFilter);

    const items = await DB.Gallery.listItems({
      cursor: cursor,
      limit: isNaN(limit) ? 20 : limit,
      type: effectiveTypeFilter,
    });

    console.log('[Gallery/items] Items returned:', items.length);

    // If no items returned, return "no more items" message
    if (!items || items.length === 0) {
      console.log('[Gallery/items] No more items to return');
      return c.html(
        <div id="no-more-items" class="text-center p-4 text-base-content/60">
          No more items
        </div>,
      );
    }

    // Return HTML fragment with gallery item cards and new sentinel
    const fragment = await renderItems(items, cursor || "", typeFilter);

    return c.html(fragment);
  } catch (error) {
    console.error("Error fetching gallery items:", error);
    return c.text("Error loading items", 500);
  }
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
