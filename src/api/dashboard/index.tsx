import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/", async (c) => {
  if (c.req.header("HX-Request")) {
    // HTMX request - return content fragment + OOB header update
    return c.html(
      <>
        {Templates.Dashboard}
        <div id="header-title" hx-swap-oob="true">
          <h1 className="text-xl font-bold">Dashboard</h1>
        </div>
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(
    Templates.layoutPage(Templates.app(Templates.Dashboard, "dashboard")),
  );
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
