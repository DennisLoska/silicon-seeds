import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/", async (c) => {
  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        {Templates.settingsFragment()}
        <div id="sidebar-settings-link" hx-swap-oob="true">
          <a
            hx-get="/api/settings/page"
            hx-target="#job-content-container"
            hx-swap="innerHTML"
            class="active bg-primary text-primary-content settings-active"
          >
            ⚙️ Settings
          </a>
        </div>
      </>,
    );
  }

  // Return the complete settings page with the correct active tab
  return c.html(Templates.settingsFragment());
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
