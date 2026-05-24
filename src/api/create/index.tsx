import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();
const { Layout, App, DistinctAudio, DistinctImage, OobHeader } = Templates;

app.get("/image", async (c) => {
  const showProgress = c.req.query("show_progress") === "true";
  const jobId = c.req.query("job_id") || "";

  // HTMX request - return content fragment + OOB header update
  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        <DistinctImage showProgress={showProgress} jobId={jobId} />
        <OobHeader title="Image" />
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(
    <Layout>
      <App page="image">
        <DistinctImage showProgress={showProgress} jobId={jobId} />
      </App>
    </Layout>,
  );
});

app.get("/audio", async (c) => {
  const showProgress = c.req.query("show_progress") === "true";
  const jobId = c.req.query("job_id") || "";

  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        <DistinctAudio showProgress={showProgress} jobId={jobId} />
        <OobHeader title="Audio" />
      </>,
    );
  }

  return c.html(
    <Layout>
      <App page="audio">
        <DistinctAudio showProgress={showProgress} jobId={jobId} />
      </App>
    </Layout>,
  );
});

app.get("/", (c) => c.redirect("/create/image"));

app.get("/*", (c) => {
  return c.redirect("/create/image");
});

export default app;
