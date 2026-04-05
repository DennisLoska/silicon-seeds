import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/", async (c) => {
  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        {Templates.dashboardFragment()}
        <div id="sidebar-dashboard-link" hx-swap-oob="true">
          <a
            hx-get="/api/dashboard"
            hx-target="#job-content-container"
            hx-swap="innerHTML"
            class="active bg-primary text-primary-content dashboard-active"
          >
            📊 Dashboard
          </a>
        </div>
      </>,
    );
  }

  // Return the complete dashboard page with the correct active tab
  return c.html(Templates.dashboardFragment());
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
