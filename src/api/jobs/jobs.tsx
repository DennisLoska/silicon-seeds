import { Hono } from "hono";
import { Templates } from "../../templates/templates";
import { DB } from "../../db/db";
import { Api } from "../api";

const app = new Hono();

app.get("/", async (c) => {
  const jobId = c.req.query("job_id") ?? null;
  const tab = c.req.query("tab") ?? "status";
  const filter = c.req.query("filter") ?? "all";

  const OobHeader = () => (
    <div id="header-title" hx-swap-oob="true">
      <h1 className="text-xl font-bold">Jobs</h1>
    </div>
  );

  if (jobId) {
    const JobDetail = await Templates.jobsFragment(jobId, tab);
    return Api.renderFragment(c, () => JobDetail, "jobs", OobHeader);
  }

  // Default to job details (most recent job) when no page is specified
  const [firstJob] = await DB.Jobs.list();

  if (!firstJob) {
    // If no jobs exist, show empty state
    const EmptyState = () => (
      <div className="p-6 text-base-content/50">No jobs yet</div>
    );

    return Api.renderFragment(c, EmptyState, "jobs", OobHeader);
  }

  const JobDetail = await Templates.jobsFragment(firstJob.id, tab);
  return Api.renderFragment(c, () => JobDetail, "jobs", OobHeader);
});

export default app;
