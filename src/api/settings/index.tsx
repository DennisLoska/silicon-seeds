import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/", async (c) => {
  if (c.req.header("HX-Request")) {
    // HTMX request - return content fragment + OOB header update
    return c.html(
      <>
        {Templates.settingsFragment()}
        <div id="header-title" hx-swap-oob="true">
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(
    Templates.layoutPage(
      Templates.app(Templates.settingsFragment(), "settings"),
    ),
  );
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
