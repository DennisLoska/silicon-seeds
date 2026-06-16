import { Hono } from "hono";
import { Templates } from "../../templates/templates";
import { DB } from "../../db/db";

const app = new Hono();
const {
  Layout,
  App,
  AutoCut,
  AutoCutStatusFragment,
  DistinctAudio,
  DistinctImage,
  HypercutPage,
  OobHeader,
} = Templates;

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

app.get("/autocut", async (c) => {
  const showProgress = c.req.query("show_progress") === "true";
  const jobId = c.req.query("job_id") || "";

  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        <AutoCut showProgress={showProgress} jobId={jobId} />
        <OobHeader title="AutoCut" />
      </>,
    );
  }

  return c.html(
    <Layout>
      <App page="autocut">
        <AutoCut showProgress={showProgress} jobId={jobId} />
      </App>
    </Layout>,
  );
});

app.get("/autocut/status", async (c) => {
  const jobId = c.req.query("job_id") || "";

  if (!jobId) {
    return c.html(<AutoCutStatusFragment jobId="missing-job-id" />);
  }

  return c.html(<AutoCutStatusFragment jobId={jobId} />);
});

import { HypercutWorkspace, HypercutSuggestions } from "../../templates/hypercut";

app.get("/hypercut", async (c) => {
  const jobId = c.req.query("job_id") || "";

  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        {jobId ? (
          <HypercutWorkspace
            jobId={jobId}
            sourceVideoUrl={`/assets/source/${jobId}`}
          />
        ) : (
          <HypercutPage />
        )}
        <OobHeader title="HyperCut" />
      </>,
    );
  }

  return c.html(
    <Layout>
      <App page="hypercut">
        {jobId ? (
          <HypercutWorkspace
            jobId={jobId}
            sourceVideoUrl={`/assets/source/${jobId}`}
          />
        ) : (
          <HypercutPage />
        )}
      </App>
    </Layout>,
  );
});

app.get("/hypercut/suggestions", async (c) => {
  const jobId = c.req.query("job_id") || "";

  if (!jobId) {
    return c.html(<div>Missing job_id</div>);
  }

  const suggestions = await DB.Hypercut.findContentSuggestionsByJob(jobId);
  return c.html(<HypercutSuggestions jobId={jobId} suggestions={suggestions} />);
});

app.get("/", (c) => c.redirect("/create/image"));

app.get("/*", (c) => {
  return c.redirect("/create/image");
});

export default app;
