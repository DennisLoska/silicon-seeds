import { Hono } from "hono";

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

export default app;
