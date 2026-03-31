import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const tab = c.req.query("tab") || "status";

  // Return the complete job-detail page with the correct active tab
  return c.html(await Templates.jobDetailFragment(jobId, tab));
});

export default app;
