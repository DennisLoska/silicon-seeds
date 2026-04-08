import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();
const { Layout, App, Compose, OobHeader } = Templates;

app.get("/", async (c) => {
  const showProgress = c.req.query("show_progress") === "true";
  const jobId = c.req.query("job_id") || "";

  // HTMX request - return content fragment + OOB header update
  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        <Compose showProgress={showProgress} jobId={jobId} />
        <OobHeader title="Compose" />
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(
    <Layout>
      <App page="compose">
        <Compose showProgress={showProgress} jobId={jobId} />
      </App>
    </Layout>,
  );
});

// Catch-all for trailing slash variants
app.get("/*", (c) => {
  return c.redirect(c.req.path.replace(/\/$/, ""));
});

export default app;
