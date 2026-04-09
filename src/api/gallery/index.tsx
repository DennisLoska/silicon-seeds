import { Hono } from "hono";
import { Templates } from "../../templates/templates";
import { DB } from "../../db/db";
import { Gallery as GalleryTemplate, renderItems } from "../../templates/gallery";

const app = new Hono();
const { Layout, App, OobHeader } = Templates;

// Main gallery page endpoint
app.get("/", async (c) => {
  const typeFilter = c.req.query("type") as string | undefined;

  // Fetch initial items for the gallery
  const initialItems = await DB.Gallery.listItems({
    limit: 20,
    type: typeFilter ? (typeFilter as "image" | "video" | "audio") : undefined,
  });

  // HTMX request - return content fragment + OOB header update
  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        <GalleryTemplate items={initialItems} typeFilter={typeFilter} />
        <OobHeader title="Gallery" />
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(
    <Layout>
      <App page="gallery">
        <GalleryTemplate items={initialItems} typeFilter={typeFilter} />
      </App>
    </Layout>,
  );
});

// Paginated items endpoint for infinite scroll
app.get("/items", async (c) => {
  const cursor = c.req.query("cursor") as string | undefined;
  const typeFilter = c.req.query("type") as string | undefined;
  const limit = parseInt(c.req.query("limit") || "20");

  try {
    const items = await DB.Gallery.listItems({
      cursor: cursor,
      limit: isNaN(limit) ? 20 : limit,
      type: typeFilter ? (typeFilter as "image" | "video" | "audio") : undefined,
    });

    // If no items returned, return "no more items" message
    if (!items || items.length === 0) {
      return c.html(
        <div id="no-more-items" class="text-center p-4 text-base-content/60">
          No more items
        </div>,
      );
    }

    // Return HTML fragment with gallery item cards
    const fragment = await renderItems(items);

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
