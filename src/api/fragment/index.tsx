import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const tab = c.req.query("tab") || "status";
  const jobDetails = await Templates.jobDetailFragment(jobId, tab);
  const jobList = await Templates.jobListFragment(jobId);

  if (c.req.header("HX-Request")) {
    return c.html(
      <>
        {jobDetails}
        <div id="sidebar" hx-swap-oob="true">
          {jobList}
        </div>
      </>,
    );
  }

  // Return the complete job-detail page with the correct active tab
  return c.html(jobDetails);
});

export default app;
