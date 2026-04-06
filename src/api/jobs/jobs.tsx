import { Hono } from "hono";
import { Templates } from "../../templates/templates";
import { DB } from "../../db/db";
import { Api } from "../api";

const app = new Hono();

app.get("/", async (c) => {
  const jobId = c.req.query("job_id") ?? null;
  const tab = c.req.query("tab") ?? "status";
  const filter = c.req.query("filter") ?? "all";

  const jobs = await DB.Jobs.list();
  const OobHeader = <Templates.OobHeader title={"Jobs"} />;

  // If no jobs match the filter, show empty state
  if (jobs.length === 0) {
    const EmptyState = () => (
      <div className="p-6 text-base-content/50">No jobs found</div>
    );

    return Api.renderFragment(c, EmptyState, "jobs", () => OobHeader);
  }

  // Default to first job from filtered list
  const selectedJobId = jobId || jobs[0].id;
  const JobDetail = await Templates.JobsFragment(selectedJobId, filter, tab);

  return Api.renderFragment(
    c,
    () => JobDetail,
    "jobs",
    () => OobHeader,
  );
});

app.get("/details/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const tab = c.req.query("tab") ?? "status";
  const filter = c.req.query("filter") ?? "all";

  if (c.req.header("HX-Request")) {
    // HTMX request - return content wrapped in #job-content-area div
    // This allows innerHTML swap to replace the entire div while keeping sidebar
    const JobTabs = Templates.JobTabsFragment(jobId, filter, tab);
    const content = await Templates.JobDetailsFragment(jobId, tab);
    return c.html(
      <>
        <div id="job-tabs-container">
          {JobTabs}
          <div id="job-content-area" className="min-h-[500px] py-4">
            {content}
          </div>
        </div>
        <div id="header-title" hx-swap-oob="true">
          <h1 className="text-xl font-bold">Jobs</h1>
        </div>
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  const jobDetails = await Templates.JobsFragment(jobId, filter, tab);
  return c.html(
    <Templates.Layout>
      <Templates.App>{jobDetails}</Templates.App>
    </Templates.Layout>,
  );
});

app.get("/events", async (c) => {
  const jobId = c.req.query("job_id");
  if (!jobId) {
    return c.html(
      <div class="p-6 text-center text-base-content/60">No job selected.</div>,
    );
  }

  const EventList = await Templates.EventList(jobId);
  return c.html(EventList);
});

export default app;
