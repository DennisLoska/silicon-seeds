import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();
const { Layout, App, Compose, OobHeader } = Templates;

app.get("/", async (c) => {
  // HTMX request - return content fragment + OOB header update
  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        <Compose />
        <OobHeader title="Compose" />
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(
    <Layout>
      <App page="compose">
        <Compose />
      </App>
    </Layout>,
  );
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
