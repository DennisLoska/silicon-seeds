import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/", async (c) => {
  if (c.req.header("HX-Request")) {
    // HTMX request - return only the content fragment
    return c.html(Templates.dashboardFragment());
  }

  // Full page load - return complete layout with sidebar
  return c.html(Templates.app(Templates.dashboardFragment(), undefined, "dashboard"));
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
