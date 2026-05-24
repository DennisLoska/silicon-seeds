import { Hono } from "hono";
import { Templates } from "../../templates/templates";
import { DB } from "../../db/db";
import { Api } from "../api";
import { JobUpdates } from "../../sse/job-updates";

const { JobsFragment, JobTabsFragment, JobContentAreaFragment, EventListFragment, GeneratedImagesFragment } =
  Templates;

const app = new Hono();
const { Layout, App } = Templates;
const { OobHeader: OobHeaderComponent } = Templates;

app.get("/", async (c) => {
  const jobId = c.req.query("job_id") ?? null;
  const tab = c.req.query("tab") ?? "status";
  const filter = c.req.query("filter") ?? "all";

  const jobs = await DB.Jobs.list();
  const oobHeaderElement = <OobHeaderComponent title="Jobs" />;

  // If no jobs match the filter, show empty state
  if (jobs.length === 0) {
    const EmptyState = () => (
      <div className="p-6 text-base-content/50">No jobs found</div>
    );

    return Api.renderFragment(c, EmptyState, "jobs", () => oobHeaderElement);
  }

  // Default to first job from filtered list
  const selectedJobId = jobId || jobs[0].id;

  return Api.renderFragment(
    c,
    () => <JobsFragment jobId={selectedJobId} filter={filter} tab={tab} />,
    "jobs",
    () => oobHeaderElement,
  );
});

app.get("/details/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const tab = c.req.query("tab") ?? "status";
  const filter = c.req.query("filter") ?? "all";

  if (c.req.header("HX-Request")) {
    // HTMX request - return content wrapped in #job-content-area div
    // This allows innerHTML swap to replace the entire div while keeping sidebar
    return c.html(
      <>
        <div id="job-tabs-container">
          <div
            id="job-tabs-container"
            data-job-id={jobId}
            hx-get={`/jobs/details/${jobId}?tab=${tab}&filter=${filter}`}
            hx-trigger={tab === "media" || tab === "events" ? "sse:job-update" : undefined}
            hx-swap="outerHTML"
          >
            <JobTabsFragment jobId={jobId} filter={filter} tab={tab} />
          {await (<JobContentAreaFragment jobId={jobId} activeTab={tab} />)}
          </div>
        </div>
        <div id="header-title" hx-swap-oob="true">
          <h1 className="text-xl font-bold">Jobs</h1>
        </div>
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(
    <Layout>
      <App>
        <JobsFragment jobId={jobId} filter={filter} tab={tab} />
      </App>
    </Layout>,
  );
});

app.get("/events", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.html(
      <div className="p-6 text-center text-base-content/60">
        No job selected.
      </div>,
    );
  }

  return c.html(await (<EventListFragment jobId={jobId} />));
});

app.get("/compose-progress", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.text("job_id is required", 400);
  }

  return c.html(await Templates.ComposeProgressFragment({ jobId }));
});

app.get("/image-progress", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.text("job_id is required", 400);
  }

  return c.html(await Templates.DistinctImageProgressFragment({ jobId }));
});

app.get("/audio-progress", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.text("job_id is required", 400);
  }

  return c.html(await Templates.DistinctAudioProgressFragment({ jobId }));
});

app.get("/generated-images", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.html(
      <div className="p-6 text-center text-base-content/60">
        No job selected.
      </div>,
    );
  }

  return c.html(await (<GeneratedImagesFragment jobId={jobId} />));
});

app.get("/generated-images-card", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.text("job_id is required", 400);
  }

  return c.html(await Templates.DistinctImageGeneratedImagesFragment({ jobId }));
});

app.get("/image-action-card", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.text("job_id is required", 400);
  }

  return c.html(
    await Templates.DistinctImageActionCardFragment({
      showProgress: true,
      jobId,
    }),
  );
});

app.get("/generated-audio-card", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.text("job_id is required", 400);
  }

  return c.html(await Templates.DistinctAudioGeneratedAudioFragment({ jobId }));
});

app.get("/stream", (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.text("job_id is required", 400);
  }

  return JobUpdates.stream(jobId);
});

export default app;
