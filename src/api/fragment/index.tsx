import { Hono } from "hono";
import { Templates } from "../../templates/templates";

const app = new Hono();

app.get("/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const tab = c.req.query("tab") || "status";
  const jobDetails = await Templates.jobDetailFragment(jobId, tab);

  if (c.req.header("HX-Request")) {
    // HTMX request - return main content + OOB header update
    return c.html(
      <>
        {jobDetails}
        <div id="header-title" hx-swap-oob="true">
          <h1 className="text-xl font-bold">Job</h1>
        </div>
      </>
    );
  }

  // Full page load - return complete layout with sidebar
  return c.html(Templates.app(jobDetails, jobId));
});

export default app;
