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

  const OobHeader = Templates.oobHeader("Jobs");
  // If no jobs match the filter, show empty state
  if (jobs.length === 0) {
    const EmptyState = () => (
      <div className="p-6 text-base-content/50">No jobs found</div>
    );

    return Api.renderFragment(c, EmptyState, "jobs", OobHeader);
  }

  // Default to first job from filtered list
  const selectedJobId = jobId || jobs[0].id;
  const JobDetail = await Templates.jobsFragment(selectedJobId, filter, tab);
  return Api.renderFragment(c, JobDetail, "jobs", OobHeader);
});

export default app;
