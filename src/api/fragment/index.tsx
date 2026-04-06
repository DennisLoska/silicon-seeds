import { Hono } from "hono";
import { Templates } from "../../templates/templates";
import { jobDetailContent, tabs } from "../../templates/jobs";

const app = new Hono();

// Delete modal route - must be registered before catch-all
app.get("/delete-modal", async (c) => {
  const jobId = c.req.query("jobId");

  // Return the complete modal structure with modal-open class
  return c.html(
    <dialog id="delete-confirm-modal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Delete Job</h3>
        <p class="py-4">
          Are you sure you want to delete this job? This action cannot be
          undone.
        </p>
        <div class="modal-action">
          <button
            class="btn"
            hx-swap="none"
            onclick="this.closest('.modal').classList.remove('modal-open')"
          >
            Cancel
          </button>
          <button
            id="confirm-delete-btn"
            class="btn btn-error"
            hx-delete={`/api/jobs/${jobId}`}
            hx-target="#job-content-container"
            hx-swap="innerHTML"
            hx-trigger="click"
          >
            Delete
          </button>
        </div>
      </div>
    </dialog>,
  );
});

app.get("/job/:jobId", async (c) => {
  const jobId = c.req.param("jobId");
  const tab = c.req.query("tab") || "status";

  if (c.req.header("HX-Request")) {
    // HTMX request - return content wrapped in #job-content-area div
    // This allows innerHTML swap to replace the entire div while keeping sidebar
    const JobTabs = tabs(jobId, tab);
    const content = await jobDetailContent(jobId, tab);
    return c.html(
      <>
        <div id="job-tabs-container">
          {JobTabs}
          <div id="job-content-area" className="min-h-[500px] py-4">
            {content}
          </div>
        </div>
        <div id="header-title" hx-swap-oob="true">
          <h1 className="text-xl font-bold">Job</h1>
        </div>
      </>,
    );
  }

  // Full page load - return complete layout with sidebar
  const jobDetails = await Templates.jobsFragment(jobId, tab);
  return c.html(Templates.layoutPage(Templates.app(jobDetails)));
});

export default app;
