import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();
const { Layout, Settings, OobHeader, App } = Templates;

app.get("/", async (c) => {
  if (c.req.header("HX-Request")) {
    // HTMX request - return content fragment + OOB header update
    return c.html(
      <>
        <Settings />
        <OobHeader title="Settings" />
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(
    <Layout>
      <App page="settings">
        <Settings />
      </App>
    </Layout>,
  );
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
