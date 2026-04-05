import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const tab = c.req.query("tab") || "status";
  const jobDetails = await Templates.jobDetailFragment(jobId, tab);

  if (c.req.header("HX-Request")) {
    // HTMX request - return only the content fragment
    return c.html(jobDetails);
  }

  // Full page load - return complete layout with sidebar
  return c.html(Templates.app(jobDetails, jobId));
});

export default app;
