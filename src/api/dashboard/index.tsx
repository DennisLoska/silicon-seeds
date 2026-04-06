import { Hono } from "hono";
import { Templates } from "../../templates/templates";
import { OobHeader } from "../../templates/oob-header";

const app = new Hono();

app.get("/", async (c) => {
  // HTMX request - return content fragment + OOB header update
  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        <Templates.Dashboard />
        <OobHeader title="Dashboard" />
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(
    <Templates.Layout>
      <Templates.App page="dashboard">
        <Templates.Dashboard />
      </Templates.App>
    </Templates.Layout>,
  );
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
