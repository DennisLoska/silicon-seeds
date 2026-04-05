import { Hono } from "hono";
import { Templates } from "../../templates/templates";

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
          <form method="dialog">
            <button class="btn">Cancel</button>
          </form>
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
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
});

app.get("/job/:jobId", async (c) => {
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
